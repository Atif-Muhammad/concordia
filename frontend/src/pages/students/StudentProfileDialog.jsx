import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { resolveFileUrl, cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Home,
  Bed,
  Receipt,
  History,
  Calendar,
  Plus,
  GraduationCap,
  DollarSign,
  TrendingUp,
  Edit,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
  Award,
  FileText,
  Filter,
  CalendarDays,
  Percent,
  Check,
  ChevronDown,
  RotateCcw,
  Wallet,
} from "lucide-react";
import {
  getStudentFeeHistory,
  getExtraChallansDedicated,
  getStudentAttendance,
  getStudentResults,
  getStudentById,
  getHostelRegistrationByStudent,
  getHostelRoomByStudent,
  getHostelFeePayments,
  getHostelChallansDedicated,
} from "../../../config/apis";
import {
  getStudentAcademicPath,
  normalizeChallan,
  getSelectedHeadsTotal,
} from "./studentFinancialUtils";
import { BoardingRegistrationHistoryPanel } from "./BoardingRegistrationHistoryPanel";
import { StudentProfilePrintDialog } from "./StudentProfilePrintTemplate";
import { StudentProfileSkeleton } from "@/skeletons/StudentProfileSkeleton";

export const StudentProfileDialog = ({
  open,
  onOpenChange,
  viewStudent,
  onEditStudent,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
}) => {
  const [activeProfileTab, setActiveProfileTab] = useState("info");
  const [activeBoardingSubTab, setActiveBoardingSubTab] = useState("details");
  const [selectedFeeSession, setSelectedFeeSession] = useState("current");
  const [selectedAttendanceScope, setSelectedAttendanceScope] = useState("all");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all");
  const [attendanceSubjectFilter, setAttendanceSubjectFilter] = useState("all");
  const [attendanceMonthFilter, setAttendanceMonthFilter] = useState("all");
  const [selectedResultsScope, setSelectedResultsScope] = useState("all");
  const [resultsExamTypeFilter, setResultsExamTypeFilter] = useState("all");
  const [profilePrintOpen, setProfilePrintOpen] = useState(false);

  const studentId = (viewStudent?.id || viewStudent?._id || "").toString();

  // Fetch installment-only challans
  const { data: studentFeesRaw = [] } = useQuery({
    queryKey: ["studentFees", studentId, "INSTALLMENT"],
    queryFn: () => getStudentFeeHistory(studentId, "INSTALLMENT"),
    enabled: open && !!studentId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const studentFees = useMemo(() => {
    return Array.isArray(studentFeesRaw)
      ? studentFeesRaw
      : Array.isArray(studentFeesRaw?.data)
      ? studentFeesRaw.data
      : [];
  }, [studentFeesRaw]);

  // Fetch extra challans (dedicated table)
  const { data: extraChallansRaw, isLoading: extraChallansLoading } = useQuery({
    queryKey: ["extraChallans", studentId],
    queryFn: () => getExtraChallansDedicated({ studentId }),
    enabled: false,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const studentExtraChallans = useMemo(() => {
    const raw = Array.isArray(extraChallansRaw)
      ? extraChallansRaw
      : Array.isArray(extraChallansRaw?.data)
      ? extraChallansRaw.data
      : [];
    return raw.map((c) => ({
      ...c,
      _normalized: true,
      student: c.student || null,
      studentId: c.studentId || studentId,
      challanType: "FEE_HEADS_ONLY",
      totalAmount: Number(c.totalAmount ?? 0),
      paidAmount: Number(c.paidAmount ?? 0),
      lateFeeFine: Number(c.lateFeeFine ?? 0),
      discount: Number(c.discount ?? 0),
      remainingAmount: Math.max(
        0,
        Number(c.totalAmount ?? 0) - Number(c.paidAmount ?? 0)
      ),
      status: c.status ?? "PENDING",
      selectedHeads: c.heads || [],
    }));
  }, [extraChallansRaw, studentId]);

  // Fetch student attendance when viewing a student
  const { data: studentAttendanceRaw = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["studentAttendance", studentId],
    queryFn: () => getStudentAttendance(studentId),
    enabled: open && !!studentId && activeProfileTab === "attendance",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const studentAttendance = useMemo(() => {
    return Array.isArray(studentAttendanceRaw)
      ? studentAttendanceRaw
      : Array.isArray(studentAttendanceRaw?.data)
      ? studentAttendanceRaw.data
      : [];
  }, [studentAttendanceRaw]);

  // Fetch student results when viewing a student
  const { data: studentResultsRaw = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["studentResults", studentId],
    queryFn: () => getStudentResults(studentId),
    enabled: open && !!studentId && activeProfileTab === "results",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const studentResults = useMemo(() => {
    return Array.isArray(studentResultsRaw)
      ? studentResultsRaw
      : Array.isArray(studentResultsRaw?.data)
      ? studentResultsRaw.data
      : [];
  }, [studentResultsRaw]);

  // Fetch full student details with statusHistory and academicRecords
  const { data: studentDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["studentDetails", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: open && !!studentId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch hostel registration and room for the viewed student
  const { data: studentHostelReg, isLoading: hostelRegLoading } = useQuery({
    queryKey: ["studentHostelReg", studentId],
    queryFn: () => getHostelRegistrationByStudent(studentId),
    enabled: open && !!studentId && activeProfileTab === "boarding",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: studentHostelRoom } = useQuery({
    queryKey: ["studentHostelRoom", studentId],
    queryFn: () => getHostelRoomByStudent(studentId),
    enabled: open && !!studentId && activeProfileTab === "boarding",
  });

  const hostelRegId = studentHostelReg?.id || studentHostelReg?._id;

  const { data: studentHostelChallansRaw } = useQuery({
    queryKey: ["studentHostelChallans", hostelRegId],
    queryFn: () => getHostelChallansDedicated({ registrationId: hostelRegId }),
    enabled:
      open &&
      !!hostelRegId &&
      activeProfileTab === "boarding" &&
      activeBoardingSubTab === "challans",
  });

  const { data: studentFeesHostelRaw = [] } = useQuery({
    queryKey: ["studentFees", studentId, "HOSTEL"],
    queryFn: () => getStudentFeeHistory(studentId, "HOSTEL"),
    enabled:
      open &&
      !!studentId &&
      activeProfileTab === "boarding" &&
      activeBoardingSubTab === "challans",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const studentFeesHostel = useMemo(() => {
    return Array.isArray(studentFeesHostelRaw)
      ? studentFeesHostelRaw
      : Array.isArray(studentFeesHostelRaw?.data)
      ? studentFeesHostelRaw.data
      : [];
  }, [studentFeesHostelRaw]);

  const studentHostelChallans = useMemo(() => {
    const fromDedicated = (
      Array.isArray(studentHostelChallansRaw)
        ? studentHostelChallansRaw
        : Array.isArray(studentHostelChallansRaw?.data)
        ? studentHostelChallansRaw.data
        : []
    ).map((c) => normalizeChallan(c));

    const fromMain = (
      Array.isArray(studentFeesHostel) ? studentFeesHostel : []
    ).map((c) => normalizeChallan(c));

    return [...fromDedicated, ...fromMain];
  }, [studentHostelChallansRaw, studentFeesHostel]);

  const processFeesData = () => {
    if (!viewStudent) {
      return {
        sessions: [],
        overall: { totalFees: 0, totalPaid: 0, totalDues: 0 },
        extraChallans: [],
        currentSessionData: null,
        selectedSessionData: null,
      };
    }

    const extraChallans = studentExtraChallans;
    const allInstallments = (
      Array.isArray(studentDetails?.feeInstallments)
        ? studentDetails.feeInstallments
        : Array.isArray(studentDetails?.installments)
        ? studentDetails.installments
        : Array.isArray(viewStudent?.feeInstallments)
        ? viewStudent.feeInstallments
        : Array.isArray(viewStudent?.installments)
        ? viewStudent.installments
        : []
    ).filter((i) => i && i.status !== "VOID");

    const instSessionMap = new Map();
    allInstallments.forEach((inst) => {
      const classId = (inst.classId?._id || inst.classId || "").toString();
      if (!classId) return;
      if (!instSessionMap.has(classId)) {
        const classObj = inst.class || classesData.find((c) => (c.id || c._id)?.toString() === classId);
        const programId = (classObj?.programId?._id || classObj?.programId || inst.programId?._id || inst.programId || "").toString();
        const programObj =
          classObj?.program || programData.find((p) => (p.id || p._id)?.toString() === programId);
        const currentStudentClassId = (viewStudent?.classId?._id || viewStudent?.classId || "").toString();
        const isCurrentSession = classId === currentStudentClassId;
        instSessionMap.set(classId, {
          sessionKey: `class-${classId}`,
          studentClassId: classId,
          studentProgramId: programId,
          program: programObj,
          class: classObj,
          isCurrentSession,
          installments: [],
          challans: [],
        });
      }
      instSessionMap.get(classId).installments.push(inst);
    });

    const regularChallans = (Array.isArray(studentFees) ? studentFees : [])
      .filter((c) => c && c.type !== "EXTRA" && c.type !== "HOSTEL")
      .map((c) => normalizeChallan(c));

    regularChallans.forEach((challan) => {
      const rawClassId = challan.installment?.classId ?? challan.studentClassId ?? null;
      const classId = (rawClassId?._id || rawClassId || "").toString();
      if (classId && instSessionMap.has(classId)) {
        instSessionMap.get(classId).challans.push(challan);
      }
    });

    const sessions = Array.from(instSessionMap.values()).map((session) => {
      const { installments } = session;

      session.challans.sort(
        (a, b) =>
          (a.installmentNumber || 0) - (b.installmentNumber || 0) ||
          new Date(a.dueDate || 0) - new Date(b.dueDate || 0)
      );

      const allClassInsts = installments;
      const activeInsts = allClassInsts.filter(
        (i) => !["SUPERSEDED", "SETTLED"].includes(i.status)
      );

      const sessionFee = allClassInsts.reduce(
        (sum, i) => sum + Number(i.basePayable || 0),
        0
      );
      const isInstPaid = (i) => {
        if (["PAID", "SETTLED"].includes(i.status)) return true;
        const targetInstId = (i.id || i._id || "").toString();
        const ch = session.challans.find((c) => {
          const cInstId = (c.installment?.id || c.installment?._id || c.installmentId || "").toString();
          return (targetInstId && cInstId && targetInstId === cInstId) ||
                 (c.installmentNumber && i.installmentNumber && Number(c.installmentNumber) === Number(i.installmentNumber));
        });
        if (ch && ["PAID", "SETTLED"].includes(ch.status)) return true;
        const plan = Number(i.basePayable ?? i.amount ?? 0);
        const paid = Number(ch?.paidAmount ?? i.paidAmount ?? 0);
        const disc = Number(ch?.discount ?? ch?.discountAmount ?? i.discount ?? 0);
        return plan > 0 && (paid + disc >= plan);
      };

      const totalInstallments = allClassInsts.length;
      const paidInstallments = allClassInsts.filter(isInstPaid).length;

      const paidThisSession = activeInsts.reduce(
        (sum, i) => sum + Number(i.paidAmount || 0),
        0
      );

      const resolveInstallmentHeadsFineDue = (inst) => {
        const lateFee = Math.max(0, Number(inst?.lateFeeFine || 0));
        const extraFine = Math.max(0, Number(inst?.extraFine || 0));
        const absFine = Math.max(0, Number(inst?.absentiesFine || 0));

        const targetInstId = (inst.id || inst._id || "").toString();
        const instChallans = (session.challans || []).filter((ch) => {
          const challanInstId = (ch.installment?.id || ch.installment?._id || ch.installmentId || "").toString();
          return challanInstId && targetInstId && challanInstId === targetInstId;
        });

        const activeChallans = instChallans
          .filter(
            (ch) =>
              !["VOID", "SUPERSEDED"].includes(String(ch?.status || "").toUpperCase())
          )
          .sort((a, b) => {
            const bt = new Date(
              b?.paidDate || b?.issueDate || b?.generatedDate || b?.createdAt || 0
            ).getTime();
            const at = new Date(
              a?.paidDate || a?.issueDate || a?.generatedDate || a?.createdAt || 0
            ).getTime();
            return bt - at;
          });

        const chosenChallan =
          activeChallans.find((ch) =>
            ["PAID", "PARTIAL", "SETTLED", "SUCCESS"].includes(
              String(ch?.status || "").toUpperCase()
            )
          ) ||
          activeChallans[0] ||
          null;

        const headsFromChallan = chosenChallan
          ? Math.max(0, Number(getSelectedHeadsTotal(chosenChallan) || 0))
          : 0;

        let inferredHeads = 0;
        if (headsFromChallan <= 0 && inst?.challanGenerated) {
          const discountAbs = Math.abs(Number(inst?.discount || 0));
          const inferred =
            Number(inst?.totalAmount || 0) -
            (Number(inst?.basePayable || 0) +
              Number(inst?.arrears || 0) +
              lateFee +
              extraFine +
              absFine -
              discountAbs);
          if (Number.isFinite(inferred) && inferred > 0) inferredHeads = inferred;
        }

        return lateFee + extraFine + absFine + Math.max(headsFromChallan, inferredHeads);
      };

      const headsPlusFinesPaid = activeInsts.reduce((sum, inst) => {
        const installmentPaid = Math.max(0, Number(inst?.paidAmount || 0));
        if (installmentPaid <= 0) return sum;
        const headsFineDue = Math.max(0, resolveInstallmentHeadsFineDue(inst));
        return sum + Math.min(installmentPaid, headsFineDue);
      }, 0);
      const tuitionPaidThisSession = Math.max(0, paidThisSession - headsPlusFinesPaid);

      const unpaidActiveInsts = activeInsts.filter((i) => !isInstPaid(i));
      const remainingDues = Math.max(0, sessionFee - paidThisSession);
      const remainingExtras = unpaidActiveInsts.reduce(
        (sum, i) => sum + Number(i.lateFeeFine || 0) + Number(i.extraFine || 0),
        0
      );

      const totalDiscount = allClassInsts.reduce(
        (sum, i) => sum + Math.abs(Number(i.discount || 0)),
        0
      );

      const sessionLabel =
        session.class && session.program
          ? [session.program.name, session.class.name].filter(Boolean).join(" / ")
          : `Class ${session.studentClassId}`;

      return {
        ...session,
        sessionLabel,
        stats: {
          sessionFee,
          paidThisSession,
          tuitionPaidThisSession,
          headsPlusFinesPaid,
          remainingDues,
          remainingExtras,
          totalDiscount,
          paidInstallments,
          totalInstallments,
          pendingInstallments: Math.max(0, totalInstallments - paidInstallments),
          advancePaid: activeInsts.reduce(
            (sum, i) => sum + (Number(i.advancePaid) || 0),
            0
          ),
        },
      };
    });

    sessions.sort((a, b) => {
      if (a.isCurrentSession) return -1;
      if (b.isCurrentSession) return 1;
      return 0;
    });

    const currentSessionData = sessions.find((s) => s.isCurrentSession) || null;
    const selectedSessionData =
      selectedFeeSession === "current"
        ? currentSessionData
        : sessions.find((s) => s.sessionKey === selectedFeeSession) ||
          currentSessionData;

    return {
      sessions,
      overall: {
        totalFees: sessions.reduce((s, sess) => s + sess.stats.sessionFee, 0),
        totalPaid: sessions.reduce((s, sess) => s + sess.stats.paidThisSession, 0),
        totalDues: sessions.reduce((s, sess) => s + sess.stats.remainingDues, 0),
      },
      extraChallans,
      currentSessionData,
      selectedSessionData,
    };
  };

  const feesData = processFeesData();

  // Helper date formatter
  const safeFormatDate = (d, fmt = "dd MMM yyyy") => {
    if (!d) return "N/A";
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return format(dateObj, fmt);
    } catch (e) {
      return String(d);
    }
  };

  // Helper grade badge
  const getGradeBadge = (grade, percentage) => {
    const g = (grade || "").toUpperCase();
    const p = Number(percentage) || 0;
    if (g.startsWith("A") || p >= 80)
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {grade || `${p}%`}
        </Badge>
      );
    if (g.startsWith("B") || p >= 60)
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          {grade || `${p}%`}
        </Badge>
      );
    if (g.startsWith("C") || p >= 50)
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">
          {grade || `${p}%`}
        </Badge>
      );
    if (g.startsWith("D") || p >= 40)
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          {grade || `${p}%`}
        </Badge>
      );
    return (
      <Badge variant="destructive" className="font-semibold">
        {grade || "F"}
      </Badge>
    );
  };

  // Helper attendance status badge
  const getAttendanceBadge = (status) => {
    const st = (status || "").toUpperCase();
    switch (st) {
      case "PRESENT":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Present
          </Badge>
        );
      case "ABSENT":
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <XCircle className="w-3.5 h-3.5" /> Absent
          </Badge>
        );
      case "LATE":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" /> Late
          </Badge>
        );
      case "LEAVE":
      case "HD":
      case "SHORT_LEAVE":
        return (
          <Badge className="bg-sky-600 hover:bg-sky-700 text-white gap-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />{" "}
            {st === "SHORT_LEAVE" ? "Short Leave" : "Leave"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  // Unified Academic Timeline Options (Current class + all historical academic records + any recorded classes)
  const academicTimelineOptions = useMemo(() => {
    const options = [
      {
        key: "all",
        label: "All Classes & Sessions (Overall)",
        isCurrent: false,
      },
    ];
    const seenKeys = new Set(["all"]);

    // 1. Current Class
    const curClassId =
      viewStudent?.classId?._id ||
      viewStudent?.classId?.id ||
      viewStudent?.classId ||
      studentDetails?.classId?._id ||
      studentDetails?.classId?.id ||
      studentDetails?.classId;
    const curSessionId =
      viewStudent?.sessionId?._id ||
      viewStudent?.sessionId?.id ||
      viewStudent?.sessionId ||
      studentDetails?.sessionId?._id ||
      studentDetails?.sessionId?.id ||
      studentDetails?.sessionId;
    const curClassName =
      viewStudent?.class?.name ||
      studentDetails?.class?.name ||
      classesData.find((c) => (c.id || c._id) === curClassId)?.name ||
      "Current Class";
    const curSessionName =
      viewStudent?.session ||
      studentDetails?.session ||
      academicSessions.find((s) => (s.id || s._id) === curSessionId)?.name ||
      "";

    const curKey = `${curClassId || "cur"}-${curSessionId || ""}`;
    if (curClassId) {
      seenKeys.add(curKey);
      options.push({
        key: curKey,
        classId: curClassId,
        sessionId: curSessionId,
        className: curClassName,
        sessionName: curSessionName,
        label: `[Current] ${curClassName}${curSessionName ? ` • ${curSessionName}` : ""}`,
        isCurrent: true,
      });
    }

    // 2. Historical academicRecords (promotions, demotions, etc.)
    const records = studentDetails?.academicRecords || [];
    records.forEach((rec, idx) => {
      const cId =
        rec.classId?._id || rec.classId?.id || (typeof rec.classId === "string" ? rec.classId : null);
      const sId =
        rec.sessionId?._id || rec.sessionId?.id || (typeof rec.sessionId === "string" ? rec.sessionId : null);
      const cName =
        rec.classId?.name ||
        classesData.find((c) => (c.id || c._id) === cId)?.name ||
        "Class";
      const sName =
        rec.sessionId?.name ||
        rec.session ||
        academicSessions.find((s) => (s.id || s._id) === sId)?.name ||
        "";
      const key = `${cId || `hist-${idx}`}-${sId || ""}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const tag = rec.isCurrent ? "Current" : (rec.status || "Previous");
        options.push({
          key,
          classId: cId,
          sessionId: sId,
          className: cName,
          sessionName: sName,
          label: `[${tag}] ${cName}${sName ? ` • ${sName}` : ""}`,
          isCurrent: !!rec.isCurrent,
          record: rec,
        });
      }
    });

    // 3. Scan studentAttendance records
    (studentAttendance || []).forEach((att) => {
      const cId = att.class?._id || att.class?.id || (typeof att.classId === "string" ? att.classId : null);
      const sId = att.session?._id || att.session?.id || (typeof att.sessionId === "string" ? att.sessionId : null);
      const key = `${cId || ""}-${sId || ""}`;
      if (cId && !seenKeys.has(key)) {
        seenKeys.add(key);
        const cName =
          att.class?.name ||
          classesData.find((c) => (c.id || c._id) === cId)?.name ||
          "Class";
        const sName =
          att.session?.name ||
          academicSessions.find((s) => (s.id || s._id) === sId)?.name ||
          "";
        options.push({
          key,
          classId: cId,
          sessionId: sId,
          className: cName,
          sessionName: sName,
          label: `${cName}${sName ? ` • ${sName}` : ""}`,
          isCurrent: false,
        });
      }
    });

    // 4. Scan studentResults records
    (studentResults || []).forEach((res) => {
      const cId =
        res.exam?.classId?._id ||
        res.exam?.classId?.id ||
        res.exam?.classId ||
        res.exam?.class?._id ||
        res.exam?.class?.id;
      const sId =
        res.exam?.sessionId?._id ||
        res.exam?.sessionId?.id ||
        res.exam?.sessionId;
      const key = `${cId || ""}-${sId || ""}`;
      if (cId && !seenKeys.has(key)) {
        seenKeys.add(key);
        const cName =
          res.exam?.class?.name ||
          res.exam?.classId?.name ||
          classesData.find((c) => (c.id || c._id) === cId)?.name ||
          "Class";
        const sName =
          res.exam?.session ||
          res.exam?.sessionId?.name ||
          academicSessions.find((s) => (s.id || s._id) === sId)?.name ||
          "";
        options.push({
          key,
          classId: cId,
          sessionId: sId,
          className: cName,
          sessionName: sName,
          label: `${cName}${sName ? ` • ${sName}` : ""}`,
          isCurrent: false,
        });
      }
    });

    return options;
  }, [
    studentDetails,
    viewStudent,
    classesData,
    academicSessions,
    studentAttendance,
    studentResults,
  ]);

  // Available Months for Attendance
  const availableAttendanceMonths = useMemo(() => {
    const map = new Map();
    (studentAttendance || []).forEach((r) => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
      if (!map.has(key)) map.set(key, label);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [studentAttendance]);

  // Available Subjects for Attendance
  const availableAttendanceSubjects = useMemo(() => {
    const map = new Map();
    (studentAttendance || []).forEach((r) => {
      const sId = (r.subject?._id || r.subject?.id || r.subjectId)?.toString();
      const sName =
        r.subject?.name ||
        (typeof r.subject === "string" && r.subject.length > 0 ? r.subject : "");
      if (sId && sName && !map.has(sId)) {
        map.set(sId, sName);
      } else if (sName && !map.has(sName)) {
        map.set(sName, sName);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [studentAttendance]);

  // Filtered Attendance List
  const filteredAttendance = useMemo(() => {
    let list = Array.isArray(studentAttendance) ? studentAttendance : [];

    // Filter by academic scope
    if (selectedAttendanceScope !== "all") {
      const selectedOption = academicTimelineOptions.find(
        (o) => o.key === selectedAttendanceScope
      );
      if (selectedOption) {
        list = list.filter((r) => {
          const cId = (r.class?._id || r.class?.id || r.classId)?.toString();
          const sId = (r.session?._id || r.session?.id || r.sessionId)?.toString();
          const matchesClass =
            !selectedOption.classId || cId === selectedOption.classId.toString();
          const matchesSession =
            !selectedOption.sessionId || sId === selectedOption.sessionId.toString();
          return matchesClass && matchesSession;
        });
      }
    }

    // Filter by status
    if (attendanceStatusFilter !== "all") {
      list = list.filter(
        (r) => (r.status || "").toUpperCase() === attendanceStatusFilter.toUpperCase()
      );
    }

    // Filter by subject
    if (attendanceSubjectFilter !== "all") {
      list = list.filter((r) => {
        const sId = (r.subject?._id || r.subject?.id || r.subjectId)?.toString();
        const sName =
          r.subject?.name || (typeof r.subject === "string" ? r.subject : "");
        return (
          sId === attendanceSubjectFilter ||
          sName.toLowerCase() === attendanceSubjectFilter.toLowerCase()
        );
      });
    }

    // Filter by month (YYYY-MM)
    if (attendanceMonthFilter !== "all") {
      list = list.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (isNaN(d.getTime())) return false;
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return mStr === attendanceMonthFilter;
      });
    }

    return list;
  }, [
    studentAttendance,
    selectedAttendanceScope,
    attendanceStatusFilter,
    attendanceSubjectFilter,
    attendanceMonthFilter,
    academicTimelineOptions,
  ]);

  // Attendance Statistics
  const attendanceStats = useMemo(() => {
    const total = filteredAttendance.length;
    let present = 0,
      absent = 0,
      late = 0,
      leave = 0;
    filteredAttendance.forEach((r) => {
      const st = (r.status || "").toUpperCase();
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
      else if (st === "LEAVE" || st === "HD" || st === "SHORT_LEAVE") leave++;
    });
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, leave, rate };
  }, [filteredAttendance]);

  // Subject-wise Breakdown
  const subjectWiseAttendance = useMemo(() => {
    const groups = {};
    filteredAttendance.forEach((r) => {
      const sName =
        r.subject?.name ||
        (typeof r.subject === "string" && r.subject.length > 0
          ? r.subject
          : "General / Homeroom");
      if (!groups[sName]) {
        groups[sName] = {
          subject: sName,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
        };
      }
      groups[sName].total++;
      const st = (r.status || "").toUpperCase();
      if (st === "PRESENT") groups[sName].present++;
      else if (st === "ABSENT") groups[sName].absent++;
      else if (st === "LATE") groups[sName].late++;
      else if (st === "LEAVE" || st === "HD" || st === "SHORT_LEAVE")
        groups[sName].leave++;
    });
    return Object.values(groups)
      .map((g) => ({
        ...g,
        rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAttendance]);

  // Monthly Breakdown
  const monthlyAttendance = useMemo(() => {
    const months = {};
    filteredAttendance.forEach((r) => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (isNaN(d.getTime())) return;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      if (!months[monthKey]) {
        months[monthKey] = {
          key: monthKey,
          label: monthLabel,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
        };
      }
      months[monthKey].total++;
      const st = (r.status || "").toUpperCase();
      if (st === "PRESENT") months[monthKey].present++;
      else if (st === "ABSENT") months[monthKey].absent++;
      else if (st === "LATE") months[monthKey].late++;
      else if (st === "LEAVE" || st === "HD" || st === "SHORT_LEAVE")
        months[monthKey].leave++;
    });
    return Object.values(months)
      .map((m) => ({
        ...m,
        rate: m.total > 0 ? Math.round((m.present / m.total) * 100) : 0,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredAttendance]);

  // Print Attendance Handler
  const handlePrintAttendance = () => {
    const printWindow = window.open("", "", "height=800,width=1000");
    if (!printWindow) return;

    const studentName = `${viewStudent?.fName || studentDetails?.fName || ""} ${viewStudent?.lName || studentDetails?.lName || ""}`.trim() || "Student";
    const roll = viewStudent?.rollNumber || studentDetails?.rollNumber || "N/A";
    const curClass = viewStudent?.class?.name || studentDetails?.class?.name || "N/A";
    const curSection = viewStudent?.section?.name || studentDetails?.section?.name || "N/A";
    const activeScopeObj = academicTimelineOptions.find((o) => o.key === selectedAttendanceScope);
    const scopeText = activeScopeObj?.label || "All Academic Sessions";

    let subjectRowsHtml = "";
    if (subjectWiseAttendance.length > 0) {
      subjectRowsHtml = `
        <div style="margin-top: 16px;">
          <h3 style="font-size: 13px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px;">Subject-wise Summary</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 6px; text-align: left; border: 1px solid #cbd5e1;">Subject</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Held</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Present</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Absent</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Late</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Leave</th>
                <th style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">Rate %</th>
              </tr>
            </thead>
            <tbody>
              ${subjectWiseAttendance
                .map(
                  (s) => `
                <tr>
                  <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: 600;">${s.subject}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">${s.total}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 600;">${s.present}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; color: #dc2626; font-weight: 600;">${s.absent}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; color: #d97706;">${s.late}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; color: #2563eb;">${s.leave}</td>
                  <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; ${
                    s.rate >= 75 ? "color: #16a34a;" : s.rate >= 60 ? "color: #d97706;" : "color: #dc2626;"
                  }">${s.rate}%</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const logRowsHtml = filteredAttendance
      .map((r, idx) => {
        const dStr = safeFormatDate(r.date, "dd MMM yyyy");
        const dayStr = r.date ? format(new Date(r.date), "EEEE") : "";
        const sName = r.subject?.name || (typeof r.subject === "string" ? r.subject : "—");
        const cName = r.class?.name || "—";
        const st = (r.status || "").toUpperCase();
        const stColor =
          st === "PRESENT"
            ? "#16a34a"
            : st === "ABSENT"
            ? "#dc2626"
            : st === "LATE"
            ? "#d97706"
            : "#2563eb";
        return `
        <tr>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">${idx + 1}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${dStr} <span style="color: #64748b; font-size: 10px;">(${dayStr})</span></td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${cName}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${sName}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; color: ${stColor};">${st}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-size: 10px; color: #475569;">${r.notes || r.reason || r.leaveType || "—"}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${studentName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; }
          .header p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 11px; }
          .info-grid div { display: flex; flex-direction: column; }
          .info-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .info-val { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .kpi-cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; }
          .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #fff; }
          .kpi-num { font-size: 18px; font-weight: 800; }
          .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background-color: #f1f5f9; padding: 6px; border: 1px solid #e2e8f0; font-weight: 600; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-block { text-align: center; border-top: 1px solid #94a3b8; width: 160px; font-size: 11px; font-weight: 500; color: #334155; padding-top: 4px; }
          @media print {
            body { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Concordia Colleges</h1>
          <p>Comprehensive Student Attendance Report</p>
        </div>

        <div class="info-grid">
          <div><span class="info-label">Student Name</span><span class="info-val">${studentName}</span></div>
          <div><span class="info-label">Roll Number</span><span class="info-val">${roll}</span></div>
          <div><span class="info-label">Class & Section</span><span class="info-val">${curClass} (${curSection})</span></div>
          <div><span class="info-label">Academic Scope</span><span class="info-val">${scopeText}</span></div>
        </div>

        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-num" style="color: ${
              attendanceStats.rate >= 75 ? "#16a34a" : attendanceStats.rate >= 60 ? "#d97706" : "#dc2626"
            };">${attendanceStats.rate}%</div>
            <div class="kpi-label">Attendance Rate</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #0f172a;">${attendanceStats.total}</div>
            <div class="kpi-label">Total Records</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #16a34a;">${attendanceStats.present}</div>
            <div class="kpi-label">Present</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #dc2626;">${attendanceStats.absent}</div>
            <div class="kpi-label">Absent</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #d97706;">${attendanceStats.late}</div>
            <div class="kpi-label">Late</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #2563eb;">${attendanceStats.leave}</div>
            <div class="kpi-label">Leave</div>
          </div>
        </div>

        ${subjectRowsHtml}

        <h3 style="font-size: 13px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px;">Attendance History Log</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th>Date & Day</th>
              <th>Class</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Notes / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${logRowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 12px; color:#64748b;">No attendance records found for this scope.</td></tr>'}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-block">Class Teacher</div>
          <div class="sig-block">Attendance In-charge</div>
          <div class="sig-block">Principal / Headmaster</div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Filtered Results List
  const filteredResults = useMemo(() => {
    let list = Array.isArray(studentResults) ? studentResults : [];

    // Scope filter
    if (selectedResultsScope !== "all") {
      const selectedOption = academicTimelineOptions.find(
        (o) => o.key === selectedResultsScope
      );
      if (selectedOption) {
        list = list.filter((r) => {
          const cId = (
            r.exam?.classId?._id ||
            r.exam?.classId?.id ||
            r.exam?.classId ||
            r.exam?.class?._id ||
            r.exam?.class?.id
          )?.toString();
          const sId = (
            r.exam?.sessionId?._id ||
            r.exam?.sessionId?.id ||
            r.exam?.sessionId
          )?.toString();
          const matchesClass =
            !selectedOption.classId || cId === selectedOption.classId.toString();
          const matchesSession =
            !selectedOption.sessionId || sId === selectedOption.sessionId.toString();
          return matchesClass && matchesSession;
        });
      }
    }

    // Exam type filter
    if (resultsExamTypeFilter !== "all") {
      list = list.filter(
        (r) =>
          (r.exam?.type || "").toUpperCase() === resultsExamTypeFilter.toUpperCase()
      );
    }

    return list;
  }, [
    studentResults,
    selectedResultsScope,
    resultsExamTypeFilter,
    academicTimelineOptions,
  ]);

  // Overall Results Statistics
  const resultsStats = useMemo(() => {
    const total = filteredResults.length;
    if (total === 0) {
      return { total: 0, avgPercentage: 0, passed: 0, failed: 0, bestScore: 0 };
    }
    const totalPercentage = filteredResults.reduce(
      (sum, r) => sum + (Number(r.percentage) || 0),
      0
    );
    const avgPercentage = Math.round(totalPercentage / total);
    const passed = filteredResults.filter(
      (r) => (Number(r.percentage) || 0) >= 40
    ).length;
    const failed = total - passed;
    const bestScore = Math.max(
      ...filteredResults.map((r) => Number(r.percentage) || 0)
    );
    return { total, avgPercentage, passed, failed, bestScore };
  }, [filteredResults]);

  // Available Exam Types in Results
  const availableExamTypes = useMemo(() => {
    const types = new Set();
    (studentResults || []).forEach((r) => {
      if (r.exam?.type) types.add(r.exam.type);
    });
    return Array.from(types);
  }, [studentResults]);

  // Print Individual Exam Result Handler
  const handlePrintExamResult = (result) => {
    const printWindow = window.open("", "", "height=800,width=900");
    if (!printWindow) return;

    const studentName = `${viewStudent?.fName || studentDetails?.fName || ""} ${viewStudent?.lName || studentDetails?.lName || ""}`.trim() || "Student";
    const fatherName = viewStudent?.fatherOrguardian || studentDetails?.fatherOrguardian || "N/A";
    const roll = viewStudent?.rollNumber || studentDetails?.rollNumber || "N/A";
    const examName = result.exam?.examName || "Examination";
    const sessionName = result.exam?.session || result.exam?.sessionId?.name || viewStudent?.session || "N/A";
    const className = result.exam?.class?.name || result.exam?.classId?.name || viewStudent?.class?.name || "N/A";

    const marksList = result.marks || [];
    const marksRowsHtml = marksList
      .map((m, idx) => {
        const sName = m.subjectName || m.subject || "Subject";
        const total = Number(m.totalMarks) || 100;
        const obtained = m.isAbsent ? "Absent" : Number(m.obtainedMarks ?? 0);
        const pct =
          total > 0 && !m.isAbsent
            ? ((Number(m.obtainedMarks ?? 0) / total) * 100).toFixed(1)
            : m.isAbsent
            ? "0.0"
            : "0.0";

        let subGrade = "F";
        const pNum = Number(pct);
        if (pNum >= 80) subGrade = "A+";
        else if (pNum >= 70) subGrade = "A";
        else if (pNum >= 60) subGrade = "B";
        else if (pNum >= 50) subGrade = "C";
        else if (pNum >= 40) subGrade = "D";

        const statusText = m.isAbsent ? "ABSENT" : pNum >= 40 ? "PASS" : "FAIL";
        const statusColor = m.isAbsent ? "#dc2626" : pNum >= 40 ? "#16a34a" : "#dc2626";

        return `
        <tr>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 500;">${sName}</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${total}</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600; ${
            m.isAbsent ? "color: #dc2626;" : ""
          }">${obtained}</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${pct}%</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">${
            m.isAbsent ? "—" : subGrade
          }</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600; color: ${statusColor};">${statusText}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Card - ${studentName} - ${examName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #0f172a; }
          .card-container { border: 3px double #0f172a; padding: 24px; border-radius: 8px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
          .header h2 { margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #2563eb; text-transform: uppercase; }
          .header p { margin: 2px 0 0 0; color: #64748b; font-size: 11px; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 12px; }
          .info-row { display: flex; flex-direction: column; }
          .info-lbl { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .info-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #0f172a; color: #fff; padding: 8px; border: 1px solid #0f172a; font-weight: 600; }
          .summary-box { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 20px; }
          .summary-item .num { font-size: 18px; font-weight: 800; color: #0f172a; }
          .summary-item .lbl { font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
          .legend { font-size: 10px; color: #64748b; margin-bottom: 30px; border-top: 1px dashed #cbd5e1; padding-top: 8px; text-align: center; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
          .sig-col { text-align: center; border-top: 1px solid #94a3b8; width: 150px; font-size: 11px; font-weight: 600; color: #334155; padding-top: 4px; }
          @media print {
            body { margin: 10mm; }
            .card-container { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="card-container">
          <div class="header">
            <h1>Concordia Colleges</h1>
            <h2>Official Examination Report Card</h2>
            <p>Academic Excellence & Character Building</p>
          </div>

          <div class="info-grid">
            <div class="info-row"><span class="info-lbl">Student Name</span><span class="info-val">${studentName}</span></div>
            <div class="info-row"><span class="info-lbl">Roll Number</span><span class="info-val">${roll}</span></div>
            <div class="info-row"><span class="info-lbl">Father / Guardian</span><span class="info-val">${fatherName}</span></div>
            <div class="info-row"><span class="info-lbl">Class</span><span class="info-val">${className}</span></div>
            <div class="info-row"><span class="info-lbl">Academic Session</span><span class="info-val">${sessionName}</span></div>
            <div class="info-row"><span class="info-lbl">Examination</span><span class="info-val">${examName}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="text-align: left;">Subject</th>
                <th>Total Marks</th>
                <th>Obtained Marks</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${marksRowsHtml || '<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748b;">No subject marks recorded for this examination.</td></tr>'}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-item">
              <div class="num">${result.totalMarks || 0}</div>
              <div class="lbl">Total Marks</div>
            </div>
            <div class="summary-item">
              <div class="num" style="color: #2563eb;">${result.obtainedMarks || 0}</div>
              <div class="lbl">Obtained Marks</div>
            </div>
            <div class="summary-item">
              <div class="num" style="color: ${result.percentage >= 50 ? "#16a34a" : "#dc2626"};">${result.percentage || 0}%</div>
              <div class="lbl">Percentage</div>
            </div>
            <div class="summary-item">
              <div class="num" style="color: #7c3aed;">${result.grade || "—"}</div>
              <div class="lbl">Grade</div>
            </div>
            <div class="summary-item">
              <div class="num" style="color: #059669;">${result.position ? `${result.position}` : result.percentage >= 40 ? "PASS" : "FAIL"}</div>
              <div class="lbl">${result.position ? "Position" : "Status"}</div>
            </div>
          </div>

          ${
            result.remarks
              ? `<div style="font-size: 12px; margin-bottom: 16px; padding: 8px 12px; background: #fafafa; border-left: 3px solid #3b82f6;"><strong>Remarks:</strong> ${result.remarks}</div>`
              : ""
          }

          <div class="legend">
            Grading Scale: A+ (80-100%) | A (70-79%) | B (60-69%) | C (50-59%) | D (40-49%) | F (&lt; 40%)
          </div>

          <div class="signatures">
            <div class="sig-col">Class In-charge</div>
            <div class="sig-col">Exam Controller</div>
            <div class="sig-col">Parent / Guardian</div>
            <div class="sig-col">Principal</div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print All Results Summary Handler
  const handlePrintAllResults = () => {
    const printWindow = window.open("", "", "height=800,width=1000");
    if (!printWindow) return;

    const studentName = `${viewStudent?.fName || studentDetails?.fName || ""} ${viewStudent?.lName || studentDetails?.lName || ""}`.trim() || "Student";
    const roll = viewStudent?.rollNumber || studentDetails?.rollNumber || "N/A";
    const curClass = viewStudent?.class?.name || studentDetails?.class?.name || "N/A";
    const activeScopeObj = academicTimelineOptions.find((o) => o.key === selectedResultsScope);
    const scopeText = activeScopeObj?.label || "All Academic Sessions";

    const rowsHtml = filteredResults
      .map((r, idx) => {
        const eName = r.exam?.examName || "Exam";
        const cName = r.exam?.class?.name || r.exam?.classId?.name || "—";
        const sName = r.exam?.session || r.exam?.sessionId?.name || "—";
        const total = r.totalMarks || 0;
        const obt = r.obtainedMarks || 0;
        const pct = r.percentage || 0;
        const gr = r.grade || "—";
        const pos = r.position || "—";
        const st = pct >= 40 ? "PASS" : "FAIL";
        const stColor = pct >= 40 ? "#16a34a" : "#dc2626";

        return `
        <tr>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">${idx + 1}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: 500;">${eName}</td>
          <td style="padding: 6px; border: 1px solid #e2e8f0;">${cName} (${sName})</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">${total}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 600;">${obt}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: 600;">${pct}%</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold;">${gr}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0;">${pos}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; color: ${stColor};">${st}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Academic Results Summary - ${studentName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; }
          .header p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 14px; font-size: 11px; }
          .info-grid div { display: flex; flex-direction: column; }
          .info-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
          .info-val { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          .kpi-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; }
          .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #fff; }
          .kpi-num { font-size: 18px; font-weight: 800; }
          .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f1f5f9; padding: 6px; border: 1px solid #e2e8f0; font-weight: 600; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-block { text-align: center; border-top: 1px solid #94a3b8; width: 160px; font-size: 11px; font-weight: 500; color: #334155; padding-top: 4px; }
          @media print {
            body { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Concordia Colleges</h1>
          <p>Comprehensive Academic Results History</p>
        </div>

        <div class="info-grid">
          <div><span class="info-label">Student Name</span><span class="info-val">${studentName}</span></div>
          <div><span class="info-label">Roll Number</span><span class="info-val">${roll}</span></div>
          <div><span class="info-label">Current Class</span><span class="info-val">${curClass}</span></div>
          <div><span class="info-label">Academic Scope</span><span class="info-val">${scopeText}</span></div>
        </div>

        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-num" style="color: #0f172a;">${resultsStats.total}</div>
            <div class="kpi-label">Total Exams</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: ${
              resultsStats.avgPercentage >= 70
                ? "#16a34a"
                : resultsStats.avgPercentage >= 50
                ? "#d97706"
                : "#dc2626"
            };">${resultsStats.avgPercentage}%</div>
            <div class="kpi-label">Average Score</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #16a34a;">${resultsStats.passed}</div>
            <div class="kpi-label">Exams Passed</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #dc2626;">${resultsStats.failed}</div>
            <div class="kpi-label">Exams Failed</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-num" style="color: #2563eb;">${resultsStats.bestScore}%</div>
            <div class="kpi-label">Best Score</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th style="text-align: left;">Exam Name</th>
              <th style="text-align: left;">Class & Session</th>
              <th>Total Marks</th>
              <th>Obtained</th>
              <th>Percentage</th>
              <th>Grade</th>
              <th>Position</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding: 12px; color:#64748b;">No results found for this scope.</td></tr>'}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-block">Examination Controller</div>
          <div class="sig-block">Academic In-charge</div>
          <div class="sig-block">Principal</div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!viewStudent) return null;

  const student = studentDetails || viewStudent;

  const academicPath = getStudentAcademicPath(
    student,
    programData,
    classesData,
    sectionsData
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>
              Complete student information and statistics
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 mr-6">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-slate-800 border-slate-300 hover:bg-slate-50"
              onClick={() => setProfilePrintOpen(true)}
              disabled={detailsLoading && !studentDetails}
            >
              <Printer className="w-4 h-4" /> Print / Export Report
            </Button>
            {onEditStudent && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onEditStudent(studentDetails || viewStudent);
                }}
                disabled={detailsLoading && !studentDetails}
              >
                <Edit className="w-4 h-4" /> Edit Student
              </Button>
            )}
          </div>
        </DialogHeader>

        {detailsLoading && !studentDetails ? (
          <StudentProfileSkeleton />
        ) : (
          <Tabs
            value={activeProfileTab}
            onValueChange={setActiveProfileTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="history">Status History</TabsTrigger>
              <TabsTrigger value="boarding">Boarding</TabsTrigger>
            </TabsList>

            {/* ── INFO TAB ── */}
            <TabsContent value="info" className="space-y-4">
              <div className="flex items-start gap-4 mb-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={resolveFileUrl(student.photo_url)} />
                  <AvatarFallback>{student.fName}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2">
                    {student.fName} {student.lName}
                  </h3>
                  <div className="flex items-center gap-4">
                    <p className="uppercase text-gray-500 tracking-wide text-sm">
                      Father / Guardian:
                    </p>
                    <p className="font-medium text-sm">
                      {student.fatherOrguardian}
                    </p>
                  </div>
                  <p className="text-muted-foreground">{student.rollNumber}</p>
                  <p className="text-sm text-muted-foreground">{academicPath}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold">Admission Date:</span>{" "}
                  {student.admissionDate || student.createdAt
                    ? format(
                        new Date(student.admissionDate || student.createdAt),
                        "dd MMMM yyyy"
                      )
                    : "-"}
                </div>
                <div>
                  <span className="font-semibold">Program / Class / Section:</span>{" "}
                  {academicPath}
                </div>
                <div>
                  <span className="font-semibold">Session:</span>{" "}
                  {student.session || "-"}
                </div>
                <div>
                  <span className="font-semibold">Gender:</span>{" "}
                  {student.gender || "-"}
                </div>
                <div>
                  <span className="font-semibold">Religion:</span>{" "}
                  {student.religion || "-"}
                </div>
                <div>
                  <span className="font-semibold">DOB:</span>{" "}
                  {student.dob
                    ? new Date(student.dob).toLocaleDateString()
                    : "-"}
                </div>
                <div>
                  <span className="font-semibold">Parent Email:</span>{" "}
                  {student.parentOrGuardianEmail || "-"}
                </div>
                <div>
                  <span className="font-semibold">Parent Phone:</span>{" "}
                  {student.parentOrGuardianPhone || "-"}
                </div>
                <div>
                  <span className="font-semibold">Parent CNIC:</span>{" "}
                  {student.parentCNIC || "-"}
                </div>
                <div>
                  <span className="font-semibold">Student CNIC:</span>{" "}
                  {student.studentCnic || "-"}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Address:</span>{" "}
                  {student.address || "-"}
                </div>

                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">Total Tuition Fee:</span>
                  <span className="font-mono font-bold">
                    Rs. {student.tuitionFee?.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Installments:</span>
                  <span className="ml-2">
                    {student.numberOfInstallments}{" "}
                    {student.numberOfInstallments === 1
                      ? "Installment"
                      : "Installments"}
                  </span>
                </div>

                {student.admissionFormNumber && (
                  <div>
                    <span className="font-semibold">Admission Form #:</span>{" "}
                    {student.admissionFormNumber}
                  </div>
                )}
                {student.previousBoardName && (
                  <div>
                    <span className="font-semibold">Previous Board:</span>{" "}
                    {student.previousBoardName}
                  </div>
                )}
                {student.previousBoardRollNumber && (
                  <div>
                    <span className="font-semibold">Board Roll #:</span>{" "}
                    {student.previousBoardRollNumber}
                  </div>
                )}
                {(student.obtainedMarks || student.totalMarks) && (
                  <div>
                    <span className="font-semibold">Previous Marks:</span>
                    <span className="ml-2 font-mono">
                      {student.obtainedMarks ?? "—"} /{" "}
                      {student.totalMarks ?? "—"}
                      {student.obtainedMarks && student.totalMarks
                        ? ` (${Math.round(
                            (student.obtainedMarks / student.totalMarks) * 100
                          )}%)`
                        : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-3">Required Documents</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: "formB", label: "Form B / Domicile" },
                    { key: "pictures", label: "4 Passport Size Pictures" },
                    { key: "dmcMatric", label: "DMC Matric" },
                    { key: "dmcIntermediate", label: "DMC Intermediate" },
                    { key: "fatherCnic", label: "Father CNIC" },
                    { key: "migration", label: "Migration" },
                    { key: "affidavit", label: "Affidavit" },
                    { key: "admissionForm", label: "Admission Form" },
                  ].map((doc) => {
                    const isSubmitted = student.documents?.[doc.key] === true;
                    return (
                      <div
                        key={doc.key}
                        className={`rounded-lg border p-3 text-sm font-medium flex items-center justify-center transition-all ${
                          isSubmitted
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-red-50 text-red-700 border-red-300"
                        }`}
                      >
                        {isSubmitted ? "Submitted" : "Missing"} {doc.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

          {/* ── FEES TAB (INSTALLMENT PLAN) ── */}
          <TabsContent
            value="fees"
            className="space-y-6 animate-in fade-in duration-300"
          >
            {/* Advance Credit Balance Banner */}
            {(() => {
              const advBal = Number(student?.advanceBalance ?? studentDetails?.advanceBalance ?? viewStudent?.advanceBalance ?? 0);
              return (
                <div className={cn(
                  "flex items-center justify-between p-3.5 rounded-lg border transition-all",
                  advBal > 0
                    ? "bg-purple-50/70 border-purple-200 text-purple-900 shadow-2xs"
                    : "bg-slate-50/70 border-slate-200 text-slate-700"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      advBal > 0 ? "bg-purple-100 text-purple-700" : "bg-slate-200/80 text-slate-500"
                    )}>
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Advance Payment Balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {advBal > 0
                          ? "Available credit will automatically deduct from future challans."
                          : "No advance payment balance currently available."}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-base font-extrabold font-mono",
                      advBal > 0 ? "text-purple-700" : "text-slate-600"
                    )}>
                      PKR {advBal.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

                {(() => {
                  const feeInsts =
                    (Array.isArray(studentDetails?.feeInstallments) && studentDetails.feeInstallments.length > 0)
                      ? studentDetails.feeInstallments
                      : (Array.isArray(studentDetails?.installments) && studentDetails.installments.length > 0)
                      ? studentDetails.installments
                      : (Array.isArray(viewStudent?.feeInstallments) && viewStudent.feeInstallments.length > 0)
                      ? viewStudent.feeInstallments
                      : (Array.isArray(viewStudent?.installments) && viewStudent.installments.length > 0)
                      ? viewStudent.installments
                      : (Array.isArray(studentFees) && studentFees.length > 0)
                      ? studentFees.map((c) => ({
                          installmentNumber: c.installmentNumber || 1,
                          amount: Number(c.amount) || Number(c.basePayable) || 0,
                          basePayable: Number(c.basePayable) || Number(c.amount) || 0,
                          dueDate: c.dueDate,
                          month: c.month,
                          session: typeof c.session === "object" ? c.session?.name : c.session,
                          sessionId: c.sessionId,
                          classId: c.classId || viewStudent?.classId || studentDetails?.classId,
                          status: c.status,
                          paidAmount: c.paidAmount || 0,
                        }))
                      : [];

                  if (!feeInsts || feeInsts.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                        <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                        <p className="text-lg text-muted-foreground mb-2">
                          No installment plan defined
                        </p>
                        <p className="text-sm text-muted-foreground">
                          This student has no scheduled installments record in the
                          system.
                        </p>
                      </div>
                    );
                  }

                  const getInstSessionName = (inst) => {
                    if (inst.session && typeof inst.session === "object")
                      return inst.session.name || "N/A";
                    if (typeof inst.session === "string" && inst.session)
                      return inst.session;
                    if (inst.sessionId) {
                      const targetSessId = (inst.sessionId?._id || inst.sessionId || "").toString();
                      const found = academicSessions.find(
                        (s) => (s.id || s._id || "").toString() === targetSessId
                      );
                      return found?.name || "N/A";
                    }
                    return viewStudent?.session || "N/A";
                  };

                  const grouped = feeInsts.reduce(
                    (acc, inst) => {
                      const sessName = getInstSessionName(inst);
                      const cleanClassId = (
                        inst.classId?._id ||
                        inst.classId ||
                        studentDetails?.classId?._id ||
                        studentDetails?.classId ||
                        viewStudent?.classId?._id ||
                        viewStudent?.classId ||
                        ""
                      ).toString();
                      const key = `${cleanClassId}-${sessName}`;
                      if (!acc[key]) {
                        const matchedClass = classesData.find(
                          (c) => (c.id || c._id || "").toString() === cleanClassId
                        );
                        acc[key] = {
                          className:
                            inst.class?.name ||
                            matchedClass?.name ||
                            studentDetails?.classId?.name ||
                            viewStudent?.classId?.name ||
                            "Class Plan",
                          session: sessName,
                          classYear: matchedClass?.year || 0,
                          installments: [],
                        };
                      }
                      acc[key].installments.push(inst);
                      return acc;
                    },
                    {}
                  );

                  const sortedGroups = Object.values(grouped).sort((a, b) => {
                    if (a.classYear !== b.classYear)
                      return a.classYear - b.classYear;
                    return a.session.localeCompare(b.session);
                  });

                  return sortedGroups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <GraduationCap className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-800">
                              {group.className}
                            </h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                              {group.session}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-slate-50 uppercase text-[10px] py-1 px-3"
                          >
                            Plan Total: PKR{" "}
                            {group.installments
                              .reduce(
                                (sum, i) =>
                                  sum + Number(i.basePayable ?? i.amount ?? 0),
                                0
                              )
                              .toLocaleString()}
                          </Badge>
                          {onEditStudent && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-primary hover:text-primary/80"
                              onClick={() => {
                                onOpenChange(false);
                                onEditStudent(studentDetails || viewStudent);
                              }}
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit Plan
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border shadow-sm overflow-hidden bg-white">
                        <Table>
                          <TableHeader className="bg-slate-50/70 border-b">
                            <TableRow>
                              <TableHead className="py-2.5 px-3 text-sm w-[80px] text-zinc-500 font-bold uppercase text-[10px]">
                                Inst. #
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-sm text-zinc-500 font-bold uppercase text-[10px]">
                                Billing Month
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-sm text-zinc-500 font-bold uppercase text-[10px]">
                                Due Date
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-sm text-right text-zinc-500 font-bold uppercase text-[10px]">
                                Plan Amount
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-sm text-right text-zinc-500 font-bold uppercase text-[10px]">
                                Status
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.installments
                              .sort(
                                (a, b) =>
                                  (a.installmentNumber || 0) -
                                    (b.installmentNumber || 0) ||
                                  new Date(a.dueDate || 0) -
                                    new Date(b.dueDate || 0)
                              )
                              .map((inst, iIdx) => {
                                const targetInstId = (inst.id || inst._id || "").toString();
                                const matchingChallan = (studentFees || []).find((ch) => {
                                  const chInstId = (ch.installment?.id || ch.installment?._id || ch.installmentId || "").toString();
                                  if (targetInstId && chInstId && targetInstId === chInstId) return true;
                                  if (ch.installmentNumber && inst.installmentNumber && Number(ch.installmentNumber) === Number(inst.installmentNumber)) {
                                    const chClassId = (ch.installment?.classId?._id || ch.installment?.classId || ch.classId || "").toString();
                                    const instClassId = (inst.classId?._id || inst.classId || "").toString();
                                    if (!chClassId || !instClassId || chClassId === instClassId) return true;
                                  }
                                  if (ch.month && inst.month && ch.month.trim().toLowerCase() === inst.month.trim().toLowerCase()) {
                                    const chClassId = (ch.installment?.classId?._id || ch.installment?.classId || ch.classId || "").toString();
                                    const instClassId = (inst.classId?._id || inst.classId || "").toString();
                                    if (!chClassId || !instClassId || chClassId === instClassId) return true;
                                  }
                                  return false;
                                });

                                const challanStatus = (matchingChallan?.status || "").toUpperCase();
                                const instStatus = (inst.status || "").toUpperCase();
                                const rawStatus = challanStatus || instStatus || "PENDING";
                                const planAmount = Number(inst.basePayable ?? inst.amount ?? matchingChallan?.basePayable ?? matchingChallan?.amount ?? matchingChallan?.totalAmount ?? 0);

                                const advApplied = Number(matchingChallan?.advanceApplied || matchingChallan?.advanceAmount || inst.advanceApplied || 0);
                                const directPaid = Number(
                                  matchingChallan?.directPaidAmount != null
                                    ? matchingChallan.directPaidAmount
                                    : (matchingChallan?.paidAmount != null && Number(matchingChallan.paidAmount) !== advApplied
                                        ? matchingChallan.paidAmount
                                        : (inst.paidAmount ?? 0))
                                );
                                const advancePaid = advApplied;
                                const arrearsSettled = Number(
                                  matchingChallan?.settledViaArrearsAmount ?? matchingChallan?.settledAmount ?? inst.settledViaArrearsAmount ?? 0
                                );
                                const totalPaid = directPaid + advancePaid + arrearsSettled;
                                const discountAmount = Number(matchingChallan?.discount ?? matchingChallan?.discountAmount ?? inst.discount ?? 0);

                                let status = "UNPAID";
                                if (
                                  challanStatus === "PAID" ||
                                  instStatus === "PAID" ||
                                  (planAmount > 0 && totalPaid + discountAmount >= planAmount)
                                ) {
                                  status = "PAID";
                                } else if (
                                  challanStatus === "SETTLED" ||
                                  instStatus === "SETTLED" ||
                                  (arrearsSettled > 0 && totalPaid + discountAmount >= planAmount)
                                ) {
                                  status = "SETTLED";
                                } else if (
                                  challanStatus === "PARTIAL" ||
                                  instStatus === "PARTIAL" ||
                                  (totalPaid > 0 && totalPaid + discountAmount < planAmount)
                                ) {
                                  status = "PARTIAL";
                                } else if (rawStatus === "OVERDUE") {
                                  status = "OVERDUE";
                                } else if (rawStatus === "VOID") {
                                  status = "VOID";
                                }

                                // User requirement:
                                // "lightest green for paid and settled, lightest orange for partial paid and transparent bg for unpaid"
                                let rowBgClass = "bg-transparent hover:bg-muted/40 transition-colors";
                                if (status === "PAID" || status === "SETTLED") {
                                  rowBgClass = "bg-green-50/70 hover:bg-green-100/60 dark:bg-green-950/20 border-b border-green-100/80 transition-colors";
                                } else if (status === "PARTIAL") {
                                  rowBgClass = "bg-orange-50/70 hover:bg-orange-100/60 dark:bg-orange-950/20 border-b border-orange-100/80 transition-colors";
                                }

                                return (
                                  <TableRow key={iIdx} className={rowBgClass}>
                                    <TableCell className="py-2.5 px-3 text-sm font-semibold">
                                      #{inst.installmentNumber}
                                    </TableCell>
                                    <TableCell className="py-2.5 px-3 text-sm">
                                      {inst.month ||
                                        (inst.dueDate
                                          ? format(
                                              new Date(inst.dueDate),
                                              "MMMM yyyy"
                                            )
                                          : "—")}
                                    </TableCell>
                                    <TableCell className="py-2.5 px-3 text-sm text-muted-foreground">
                                      {inst.dueDate
                                        ? format(
                                            new Date(inst.dueDate),
                                            "dd/MM/yyyy"
                                          )
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="py-2.5 px-3 text-sm text-right font-mono font-medium">
                                      PKR {planAmount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="py-2.5 px-3 text-sm text-right">
                                      {status === "PAID" && (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-bold text-[10px] uppercase tracking-wide">
                                            PAID
                                          </Badge>
                                          {(advancePaid > 0 || arrearsSettled > 0) ? (
                                            <div className="flex items-center gap-1 flex-wrap justify-end text-[9px] font-mono mt-0.5">
                                              {directPaid > 0 && (
                                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
                                                  Direct: PKR {directPaid.toLocaleString()}
                                                </span>
                                              )}
                                              {advancePaid > 0 && (
                                                <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200">
                                                  Adv: PKR {advancePaid.toLocaleString()}
                                                </span>
                                              )}
                                              {arrearsSettled > 0 && (
                                                <span className="bg-amber-50 text-amber-800 px-1 py-0.5 rounded border border-amber-200">
                                                  Arrears: PKR {arrearsSettled.toLocaleString()}
                                                </span>
                                              )}
                                              {discountAmount > 0 && (
                                                <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200">
                                                  Disc: PKR {discountAmount.toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          ) : discountAmount > 0 ? (
                                            <span className="text-[10px] text-emerald-700 font-semibold font-mono">
                                              Paid: PKR {totalPaid.toLocaleString()} (Disc: PKR {discountAmount.toLocaleString()})
                                            </span>
                                          ) : null}
                                        </div>
                                      )}
                                      {status === "SETTLED" && (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-bold text-[10px] uppercase tracking-wide">
                                            SETTLED
                                          </Badge>
                                          <div className="flex items-center gap-1 flex-wrap justify-end text-[9px] font-mono mt-0.5">
                                            {directPaid > 0 && (
                                              <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
                                                Direct: PKR {directPaid.toLocaleString()}
                                              </span>
                                            )}
                                            {arrearsSettled > 0 && (
                                              <span className="bg-amber-50 text-amber-800 px-1 py-0.5 rounded border border-amber-200">
                                                Rolled: PKR {arrearsSettled.toLocaleString()}
                                              </span>
                                            )}
                                            {matchingChallan?.settledByChallanNo && (
                                              <span className="text-[9px] text-muted-foreground font-mono">
                                                (#{matchingChallan.settledByChallanNo})
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {status === "PARTIAL" && (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border border-orange-300 font-bold text-[10px] uppercase tracking-wide">
                                            PARTIAL
                                          </Badge>
                                          <span className="text-[10px] text-orange-700 font-bold font-mono">
                                            Paid: PKR {totalPaid.toLocaleString()}
                                          </span>
                                          {(advancePaid > 0 || arrearsSettled > 0) && (
                                            <div className="flex items-center gap-1 flex-wrap justify-end text-[9px] font-mono mt-0.5">
                                              {directPaid > 0 && (
                                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">
                                                  Direct: PKR {directPaid.toLocaleString()}
                                                </span>
                                              )}
                                              {advancePaid > 0 && (
                                                <span className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-200">
                                                  Adv: PKR {advancePaid.toLocaleString()}
                                                </span>
                                              )}
                                              {arrearsSettled > 0 && (
                                                <span className="bg-amber-50 text-amber-800 px-1 py-0.5 rounded border border-amber-200">
                                                  Arrears: PKR {arrearsSettled.toLocaleString()}
                                                </span>
                                              )}
                                              {discountAmount > 0 && (
                                                <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200">
                                                  Disc: PKR {discountAmount.toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          {advancePaid === 0 && arrearsSettled === 0 && discountAmount > 0 && (
                                            <span className="text-[9px] text-emerald-700 font-semibold font-mono">
                                              (Disc: PKR {discountAmount.toLocaleString()})
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {status === "UNPAID" && (
                                        <Badge variant="outline" className="text-slate-500 border-slate-300 font-medium text-[10px] uppercase tracking-wide">
                                          UNPAID
                                        </Badge>
                                      )}
                                      {status === "OVERDUE" && (
                                        <Badge variant="destructive" className="font-bold text-[10px] uppercase tracking-wide">
                                          OVERDUE
                                        </Badge>
                                      )}
                                      {status === "VOID" && (
                                        <Badge variant="outline" className="opacity-60 font-medium text-[10px] uppercase tracking-wide">
                                          VOID
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ));
                })()}
          </TabsContent>

          {/* ── ATTENDANCE TAB ── */}
          <TabsContent value="attendance" className="flex-1 overflow-y-auto space-y-6 pt-2">
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground">Loading attendance records...</p>
              </div>
            ) : studentAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-muted/20 p-8">
                <CalendarDays className="w-12 h-12 text-muted-foreground/60 mb-3" />
                <p className="text-lg font-semibold text-foreground mb-1">No Attendance Records Found</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  This student has no attendance sessions recorded in the system yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Controls Bar: Academic Timeline / Class Scope, Filters, and Print */}
                <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                        {/* Scope / Timeline Selector */}
                        <div className="min-w-[230px] flex-1">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Academic Progression Scope
                          </Label>
                          <Select
                            value={selectedAttendanceScope}
                            onValueChange={setSelectedAttendanceScope}
                          >
                            <SelectTrigger className="h-9 w-full bg-background">
                              <SelectValue placeholder="Select academic scope" />
                            </SelectTrigger>
                            <SelectContent>
                              {academicTimelineOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="w-[130px]">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Status
                          </Label>
                          <Select
                            value={attendanceStatusFilter}
                            onValueChange={setAttendanceStatusFilter}
                          >
                            <SelectTrigger className="h-9 bg-background">
                              <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="PRESENT">Present</SelectItem>
                              <SelectItem value="ABSENT">Absent</SelectItem>
                              <SelectItem value="LATE">Late</SelectItem>
                              <SelectItem value="LEAVE">Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Subject Filter (if multiple subjects exist) */}
                        {availableAttendanceSubjects.length > 1 && (
                          <div className="w-[160px]">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                              Subject
                            </Label>
                            <Select
                              value={attendanceSubjectFilter}
                              onValueChange={setAttendanceSubjectFilter}
                            >
                              <SelectTrigger className="h-9 bg-background">
                                <SelectValue placeholder="All Subjects" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {availableAttendanceSubjects.map((sub) => (
                                  <SelectItem key={sub.value} value={sub.value}>
                                    {sub.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Month Filter */}
                        {availableAttendanceMonths.length > 1 && (
                          <div className="w-[130px]">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                              Month
                            </Label>
                            <Select
                              value={attendanceMonthFilter}
                              onValueChange={setAttendanceMonthFilter}
                            >
                              <SelectTrigger className="h-9 bg-background">
                                <SelectValue placeholder="All Months" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {availableAttendanceMonths.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Right Action buttons: Reset & Print */}
                      <div className="flex items-center gap-2 self-end">
                        {(attendanceStatusFilter !== "all" ||
                          attendanceSubjectFilter !== "all" ||
                          attendanceMonthFilter !== "all" ||
                          selectedAttendanceScope !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => {
                              setSelectedAttendanceScope("all");
                              setAttendanceStatusFilter("all");
                              setAttendanceSubjectFilter("all");
                              setAttendanceMonthFilter("all");
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 font-medium shadow-2xs"
                          onClick={handlePrintAttendance}
                        >
                          <Printer className="w-4 h-4 text-primary" /> Print Attendance
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <Card className="border shadow-2xs">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Attendance Rate</p>
                      <p
                        className={`text-2xl font-bold mt-1 ${
                          attendanceStats.rate >= 75
                            ? "text-emerald-600 dark:text-emerald-400"
                            : attendanceStats.rate >= 60
                            ? "text-amber-500"
                            : "text-rose-600"
                        }`}
                      >
                        {attendanceStats.rate}%
                      </p>
                      <Badge
                        variant="secondary"
                        className="mt-1 text-[10px] font-semibold tracking-wide"
                      >
                        {attendanceStats.rate >= 75
                          ? "Good Standing"
                          : attendanceStats.rate >= 60
                          ? "Average"
                          : "Needs Attention"}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Classes Held</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{attendanceStats.total}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Total Sessions</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">Present</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{attendanceStats.present}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {attendanceStats.total > 0 ? Math.round((attendanceStats.present / attendanceStats.total) * 100) : 0}% of total
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-rose-700 dark:text-rose-400 uppercase">Absent</p>
                      <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{attendanceStats.absent}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {attendanceStats.total > 0 ? Math.round((attendanceStats.absent / attendanceStats.total) * 100) : 0}% of total
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">Late</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{attendanceStats.late}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Marked Late</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-400 uppercase">Leave</p>
                      <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">{attendanceStats.leave}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Excused / Medical</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Bar with minimum target */}
                <Card className="border shadow-2xs">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-primary" /> Overall Attendance Track
                      </span>
                      <span className="font-bold text-foreground">
                        {attendanceStats.present} / {attendanceStats.total} Classes ({attendanceStats.rate}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 relative overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          attendanceStats.rate >= 75
                            ? "bg-emerald-500"
                            : attendanceStats.rate >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.min(attendanceStats.rate, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>0%</span>
                      <span className="text-amber-600 font-medium">60% Minimum</span>
                      <span className="text-emerald-600 font-medium">75% Target</span>
                      <span>100%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Subject-Wise Attendance Breakdown */}
                {subjectWiseAttendance.length > 0 && (
                  <Card className="border shadow-2xs">
                    <CardHeader className="py-3 px-4 border-b bg-muted/20">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" /> Subject-wise Attendance Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="py-2.5 px-4 font-semibold text-xs">Subject</TableHead>
                            <TableHead className="py-2.5 px-3 font-semibold text-xs text-center">Classes Held</TableHead>
                            <TableHead className="py-2.5 px-3 font-semibold text-xs text-center text-emerald-600">Present</TableHead>
                            <TableHead className="py-2.5 px-3 font-semibold text-xs text-center text-rose-600">Absent</TableHead>
                            <TableHead className="py-2.5 px-3 font-semibold text-xs text-center text-amber-600">Late</TableHead>
                            <TableHead className="py-2.5 px-3 font-semibold text-xs text-center text-sky-600">Leave</TableHead>
                            <TableHead className="py-2.5 px-4 font-semibold text-xs text-right">Attendance Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subjectWiseAttendance.map((sub, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30">
                              <TableCell className="py-2.5 px-4 font-medium text-sm">
                                {sub.subject}
                              </TableCell>
                              <TableCell className="py-2.5 px-3 text-center text-sm font-semibold">{sub.total}</TableCell>
                              <TableCell className="py-2.5 px-3 text-center text-sm font-semibold text-emerald-600">{sub.present}</TableCell>
                              <TableCell className="py-2.5 px-3 text-center text-sm font-semibold text-rose-600">{sub.absent}</TableCell>
                              <TableCell className="py-2.5 px-3 text-center text-sm font-semibold text-amber-600">{sub.late}</TableCell>
                              <TableCell className="py-2.5 px-3 text-center text-sm font-semibold text-sky-600">{sub.leave}</TableCell>
                              <TableCell className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-muted rounded-full h-2 hidden sm:block">
                                    <div
                                      className={`h-2 rounded-full ${
                                        sub.rate >= 75
                                          ? "bg-emerald-500"
                                          : sub.rate >= 60
                                          ? "bg-amber-500"
                                          : "bg-rose-500"
                                      }`}
                                      style={{ width: `${Math.min(sub.rate, 100)}%` }}
                                    />
                                  </div>
                                  <Badge
                                    className={`font-semibold ${
                                      sub.rate >= 75
                                        ? "bg-emerald-600 text-white"
                                        : sub.rate >= 60
                                        ? "bg-amber-500 text-white"
                                        : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {sub.rate}%
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly History Cards */}
                {monthlyAttendance.length > 0 && (
                  <Card className="border shadow-2xs">
                    <CardHeader className="py-3 px-4 border-b bg-muted/20">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" /> Monthly Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {monthlyAttendance.map((m) => (
                          <div
                            key={m.key}
                            className="p-3 rounded-lg border bg-background flex flex-col justify-between space-y-2 shadow-2xs"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-sm">{m.label}</span>
                              <Badge
                                variant={m.rate >= 75 ? "default" : m.rate >= 60 ? "secondary" : "destructive"}
                                className="font-bold"
                              >
                                {m.rate}%
                              </Badge>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  m.rate >= 75
                                    ? "bg-emerald-500"
                                    : m.rate >= 60
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(m.rate, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                              <span>Held: <strong className="text-foreground">{m.total}</strong></span>
                              <span className="text-emerald-600">P: {m.present}</span>
                              <span className="text-rose-600">A: {m.absent}</span>
                              <span className="text-amber-600">L: {m.late}</span>
                              <span className="text-sky-600">Lv: {m.leave}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Chronological Detailed Log Table */}
                <Card className="border shadow-2xs">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> Detailed Attendance Log
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Showing {filteredAttendance.length} record{filteredAttendance.length !== 1 ? "s" : ""}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[350px] overflow-y-auto">
                    {filteredAttendance.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        No records match the current filter criteria.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow className="border-b shadow-2xs">
                            <TableHead className="py-2 px-3 text-xs w-[120px]">Date</TableHead>
                            <TableHead className="py-2 px-3 text-xs w-[90px]">Day</TableHead>
                            <TableHead className="py-2 px-3 text-xs">Class / Section</TableHead>
                            <TableHead className="py-2 px-3 text-xs">Subject</TableHead>
                            <TableHead className="py-2 px-3 text-xs w-[120px] text-center">Status</TableHead>
                            <TableHead className="py-2 px-3 text-xs">Notes / Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAttendance.map((rec, idx) => {
                            const dObj = rec.date ? new Date(rec.date) : null;
                            const dayName = dObj && !isNaN(dObj.getTime()) ? format(dObj, "EEEE") : "—";
                            const cName = rec.class?.name || (typeof rec.class === "string" ? rec.class : "—");
                            const secName = rec.section?.name || "";
                            const sName = rec.subject?.name || (typeof rec.subject === "string" ? rec.subject : "—");
                            return (
                              <TableRow key={rec.id || idx} className="hover:bg-muted/30">
                                <TableCell className="py-2 px-3 text-xs font-semibold">
                                  {safeFormatDate(rec.date, "dd MMM yyyy")}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                                  {dayName}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs">
                                  {cName}{secName ? ` • ${secName}` : ""}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs font-medium text-foreground">
                                  {sName}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-center">
                                  {getAttendanceBadge(rec.status)}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs text-muted-foreground">
                                  {rec.notes || rec.reason || rec.leaveType || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ── RESULTS TAB ── */}
          <TabsContent value="results" className="flex-1 overflow-y-auto space-y-6 pt-2">
            {resultsLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground">Loading exam results...</p>
              </div>
            ) : studentResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-muted/20 p-8">
                <Award className="w-12 h-12 text-muted-foreground/60 mb-3" />
                <p className="text-lg font-semibold text-foreground mb-1">No Exam Results Recorded</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  This student has not participated in any examinations or marks have not been entered yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Controls Bar: Academic Timeline / Class Scope, Exam Type Filter, and Print */}
                <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                        {/* Scope / Timeline Selector */}
                        <div className="min-w-[240px] flex-1">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Academic Progression Scope
                          </Label>
                          <Select
                            value={selectedResultsScope}
                            onValueChange={setSelectedResultsScope}
                          >
                            <SelectTrigger className="h-9 w-full bg-background">
                              <SelectValue placeholder="Select academic scope" />
                            </SelectTrigger>
                            <SelectContent>
                              {academicTimelineOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Exam Type Filter */}
                        {availableExamTypes.length > 1 && (
                          <div className="w-[160px]">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                              Exam Type
                            </Label>
                            <Select
                              value={resultsExamTypeFilter}
                              onValueChange={setResultsExamTypeFilter}
                            >
                              <SelectTrigger className="h-9 bg-background">
                                <SelectValue placeholder="All Types" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {availableExamTypes.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 self-end">
                        {(selectedResultsScope !== "all" || resultsExamTypeFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => {
                              setSelectedResultsScope("all");
                              setResultsExamTypeFilter("all");
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 font-medium shadow-2xs"
                          onClick={handlePrintAllResults}
                          disabled={filteredResults.length === 0}
                        >
                          <Printer className="w-4 h-4 text-primary" /> Print Summary
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Overall Examination Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="border shadow-2xs">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Exams Taken</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{resultsStats.total}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Total Exams</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Average Score</p>
                      <p
                        className={`text-2xl font-bold mt-1 ${
                          resultsStats.avgPercentage >= 70
                            ? "text-emerald-600 dark:text-emerald-400"
                            : resultsStats.avgPercentage >= 50
                            ? "text-amber-500"
                            : "text-rose-600"
                        }`}
                      >
                        {resultsStats.avgPercentage}%
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Across all subjects</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">Passed</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{resultsStats.passed}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Examinations</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-rose-700 dark:text-rose-400 uppercase">Failed</p>
                      <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{resultsStats.failed}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Under 40%</p>
                    </CardContent>
                  </Card>

                  <Card className="border shadow-2xs bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/50 col-span-2 md:col-span-1">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase">Best Score</p>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{resultsStats.bestScore}%</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Highest percentage</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Individual Exam Cards */}
                {filteredResults.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
                    No examination results found matching the selected filter.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {filteredResults.map((result) => {
                      const examTitle = result.exam?.examName || "Examination";
                      const className =
                        result.exam?.class?.name ||
                        result.exam?.classId?.name ||
                        "Class";
                      const sessionName =
                        result.exam?.session ||
                        result.exam?.sessionId?.name ||
                        "";
                      const examType = result.exam?.type;
                      const hasMarks = result.marks && result.marks.length > 0;
                      const isPassing = (result.percentage || 0) >= 40;

                      return (
                        <Card key={result.id || result._id} className="border shadow-sm overflow-hidden">
                          {/* Card Header with exam metadata and print button */}
                          <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CardTitle className="text-base font-bold text-foreground">
                                    {examTitle}
                                  </CardTitle>
                                  <Badge variant="outline" className="font-medium text-xs">
                                    {className}{sessionName ? ` • ${sessionName}` : ""}
                                  </Badge>
                                  {examType && (
                                    <Badge variant="secondary" className="text-xs font-medium uppercase">
                                      {examType}
                                    </Badge>
                                  )}
                                  <Badge
                                    className={`text-xs font-semibold ${
                                      isPassing
                                        ? "bg-emerald-600 text-white"
                                        : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {isPassing ? "PASSED" : "FAILED"}
                                  </Badge>
                                </div>
                                {(result.exam?.startDate || result.exam?.endDate) && (
                                  <p className="text-xs text-muted-foreground">
                                    Exam Period: {safeFormatDate(result.exam.startDate)} - {safeFormatDate(result.exam.endDate)}
                                  </p>
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs font-medium shadow-2xs"
                                onClick={() => handlePrintExamResult(result)}
                              >
                                <Printer className="w-3.5 h-3.5 text-primary" /> Print Report Card
                              </Button>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 space-y-4">
                            {/* Performance summary tiles */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-muted/20 rounded-lg border">
                              <div>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Total Marks</span>
                                <span className="text-lg font-bold text-foreground">{result.totalMarks || 0}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Obtained Marks</span>
                                <span className="text-lg font-bold text-primary">{result.obtainedMarks || 0}</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Percentage</span>
                                <span
                                  className={`text-lg font-bold ${
                                    isPassing ? "text-emerald-600" : "text-rose-600"
                                  }`}
                                >
                                  {result.percentage || 0}%
                                </span>
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Overall Grade</span>
                                <div className="mt-0.5">
                                  {getGradeBadge(result.grade, result.percentage)}
                                </div>
                              </div>
                              <div>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Position</span>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                  {result.position ? `${result.position}` : "—"}
                                </span>
                              </div>
                            </div>

                            {/* Subject-Wise Marks Breakdown Table */}
                            {hasMarks ? (
                              <div className="rounded-lg border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/40">
                                      <TableHead className="py-2 px-3 text-xs w-[40px] text-center">#</TableHead>
                                      <TableHead className="py-2 px-3 text-xs">Subject</TableHead>
                                      <TableHead className="py-2 px-3 text-xs text-center">Total</TableHead>
                                      <TableHead className="py-2 px-3 text-xs text-center">Obtained</TableHead>
                                      <TableHead className="py-2 px-3 text-xs text-center">Percent</TableHead>
                                      <TableHead className="py-2 px-3 text-xs text-center">Grade</TableHead>
                                      <TableHead className="py-2 px-3 text-xs text-center">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {result.marks.map((mark, mIdx) => {
                                      const sName = mark.subjectName || mark.subject || "Subject";
                                      const tot = Number(mark.totalMarks) || 100;
                                      const obt = mark.isAbsent ? 0 : Number(mark.obtainedMarks || 0);
                                      const pct = tot > 0 && !mark.isAbsent ? Math.round((obt / tot) * 100) : 0;
                                      const subPass = pct >= 40 && !mark.isAbsent;

                                      return (
                                        <TableRow key={mark.id || mIdx} className="hover:bg-muted/30">
                                          <TableCell className="py-2 px-3 text-xs text-center text-muted-foreground">
                                            {mIdx + 1}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-xs font-semibold text-foreground">
                                            {sName}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-xs text-center font-medium">
                                            {tot}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-xs text-center font-bold">
                                            {mark.isAbsent ? (
                                              <span className="text-rose-600 font-bold">Absent</span>
                                            ) : (
                                              <span>{obt}</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-xs text-center font-medium">
                                            {mark.isAbsent ? "—" : `${pct}%`}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-center">
                                            {mark.isAbsent ? "—" : getGradeBadge(null, pct)}
                                          </TableCell>
                                          <TableCell className="py-2 px-3 text-center">
                                            <Badge
                                              variant={mark.isAbsent || !subPass ? "destructive" : "outline"}
                                              className="text-[10px] font-semibold py-0 px-2"
                                            >
                                              {mark.isAbsent ? "ABSENT" : subPass ? "PASS" : "FAIL"}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Individual subject-wise marks breakdown is not available for this exam result.
                              </p>
                            )}

                            {/* Remarks Callout */}
                            {result.remarks && (
                              <div className="text-xs p-2.5 rounded bg-muted/30 border-l-2 border-primary text-muted-foreground">
                                <strong className="text-foreground">Remarks:</strong> {result.remarks}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── STATUS HISTORY TAB ── */}
          <TabsContent value="history" className="flex-1 overflow-y-auto">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Loading status history...
                </p>
              </div>
            ) : (() => {
              const allHistory = studentDetails?.statusHistory || [];
              if (allHistory.length === 0)
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-lg text-muted-foreground mb-2">
                      No status history found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This student has no recorded status changes yet.
                    </p>
                  </div>
                );
              return (
                <div className="space-y-4">
                  {allHistory.map((history) => (
                    <div
                      key={history.id}
                      className="relative pl-6 pb-6 border-l-2 last:border-0 border-border"
                    >
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary" />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              history.newStatus === "ACTIVE"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {history.newStatus}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(history.createdAt).toLocaleString()}
                          </span>
                          {history.sessionId && (
                            <Badge variant="outline" className="text-xs">
                              {academicSessions.find(
                                (s) =>
                                  s.id.toString() ===
                                  history.sessionId?.toString()
                              )?.name || `Session ${history.sessionId}`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-1">
                          {history.previousStatus
                            ? `${history.previousStatus} → `
                            : ""}
                          {history.newStatus}
                        </p>
                        {history.reason && (
                          <p className="text-sm text-muted-foreground italic bg-muted/50 p-2 rounded mt-1">
                            "{history.reason}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          {/* ── BOARDING TAB ── */}
          <TabsContent value="boarding" className="space-y-4">
            {hostelRegLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Loading boarding info...
                </p>
              </div>
            ) : !studentHostelReg ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                <Home className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-lg text-muted-foreground mb-2">
                  Not registered in Boarding
                </p>
                <p className="text-sm text-muted-foreground">
                  This student has no boarding registration.
                </p>
              </div>
            ) : (
              <Tabs
                value={activeBoardingSubTab}
                onValueChange={setActiveBoardingSubTab}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="challans" className="flex-1">
                    Fee Challans
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-3">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        studentHostelReg.status === "active"
                          ? "default"
                          : studentHostelReg.status === "terminated"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-sm px-3 py-1 capitalize"
                    >
                      {studentHostelReg.status}
                    </Badge>
                    {studentHostelReg.status === "terminated" &&
                      (() => {
                        const reason = (() => {
                          if (!studentHostelReg.terminationReason) return null;
                          try {
                            const arr = JSON.parse(
                              studentHostelReg.terminationReason
                            );
                            if (Array.isArray(arr)) {
                              const last = [...arr]
                                .reverse()
                                .find(
                                  (e) => e.action === "terminated" && e.reason
                                );
                              return last?.reason || null;
                            }
                          } catch {}
                          return studentHostelReg.terminationReason;
                        })();
                        return reason ? (
                          <span className="text-xs text-red-600 italic">
                            Reason: "{reason}"
                          </span>
                        ) : null;
                      })()}
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Home className="w-5 h-5 text-primary" /> Boarding
                        Registration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold">Boarding:</span>{" "}
                        {studentHostelReg.hostelName}
                      </div>
                      <div>
                        <span className="font-semibold">
                          Registration Date:
                        </span>{" "}
                        {studentHostelReg.registrationDate
                          ? new Date(
                              studentHostelReg.registrationDate
                            ).toLocaleDateString()
                          : "-"}
                      </div>
                      <div>
                        <span className="font-semibold">Registration ID:</span>{" "}
                        <span className="text-xs text-muted-foreground font-mono">
                          {studentHostelReg.id}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">
                          Decided Fee/Month:
                        </span>{" "}
                        {studentHostelReg.decidedFeePerMonth != null
                          ? `PKR ${Number(
                              studentHostelReg.decidedFeePerMonth
                            ).toLocaleString()}`
                          : "-"}
                      </div>
                    </CardContent>
                  </Card>
                  {studentHostelRoom && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Bed className="w-5 h-5 text-primary" /> Room
                          Allocation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold">Room Number:</span>{" "}
                          {studentHostelRoom.room?.roomNumber}
                        </div>
                        <div>
                          <span className="font-semibold">Room Type:</span>{" "}
                          {studentHostelRoom.room?.roomType}
                        </div>
                        <div>
                          <span className="font-semibold">Capacity:</span>{" "}
                          {studentHostelRoom.room?.capacity}
                        </div>
                        <div>
                          <span className="font-semibold">Occupancy:</span>{" "}
                          {studentHostelRoom.room?.currentOccupancy} /{" "}
                          {studentHostelRoom.room?.capacity}
                        </div>
                        <div>
                          <span className="font-semibold">
                            Allocation Date:
                          </span>{" "}
                          {studentHostelRoom.allocationDate
                            ? new Date(
                                studentHostelRoom.allocationDate
                              ).toLocaleDateString()
                            : "-"}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="challans" className="mt-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-primary" /> Fee
                        Challans
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {studentHostelChallans.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No fee challans generated yet.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 px-3 text-sm">
                                Challan No
                              </TableHead>
                              <TableHead className="py-2 px-3 text-sm">
                                Month
                              </TableHead>
                              <TableHead className="py-2 px-3 text-sm">
                                Total
                              </TableHead>
                              <TableHead className="py-2 px-3 text-sm">
                                Paid
                              </TableHead>
                              <TableHead className="py-2 px-3 text-sm">
                                Due Date
                              </TableHead>
                              <TableHead className="py-2 px-3 text-sm">
                                Status
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentHostelChallans.map((c) => {
                              const total =
                                c.snapshotTotalDue != null
                                  ? Number(c.snapshotTotalDue)
                                  : (c.hostelFee || 0) +
                                    (c.fineAmount || 0) +
                                    (c.lateFeeFine || 0) +
                                    (c.arrearsAmount || 0) -
                                    (c.discount || 0);
                              const balance = Math.max(
                                0,
                                total - (c.paidAmount || 0)
                              );
                              return (
                                <TableRow
                                  key={c.id}
                                  className={
                                    ["VOID", "SUPERSEDED", "SETTLED"].includes(
                                      c.status
                                    )
                                      ? "opacity-50"
                                      : ""
                                  }
                                >
                                  <TableCell className="py-2 px-3 text-sm font-medium text-xs">
                                    {c.challanNumber}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    {c.month}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    PKR {total.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm text-green-600">
                                    PKR {(c.paidAmount || 0).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    {c.dueDate
                                      ? new Date(c.dueDate).toLocaleDateString()
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="py-2 px-3 text-sm">
                                    <div className="flex flex-col gap-0.5">
                                      <Badge
                                        variant={
                                          c.status === "PAID"
                                            ? "default"
                                            : ["VOID", "SUPERSEDED", "SETTLED"].includes(
                                                c.status
                                              )
                                            ? "outline"
                                            : c.status === "PARTIAL"
                                            ? "warning"
                                            : "secondary"
                                        }
                                      >
                                        {["VOID", "SUPERSEDED", "SETTLED"].includes(
                                          c.status
                                        )
                                          ? "Superseded"
                                          : c.status}
                                      </Badge>
                                      {balance > 0 &&
                                        ![
                                          "VOID",
                                          "SUPERSEDED",
                                          "SETTLED",
                                        ].includes(c.status) && (
                                          <span className="text-[10px] text-red-600">
                                            Due: PKR {balance.toLocaleString()}
                                          </span>
                                        )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-3">
                  <BoardingRegistrationHistoryPanel
                    regId={studentHostelReg.id}
                  />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      )}

        {/* Student Profile Form Print / PDF Preview Dialog */}
        <StudentProfilePrintDialog
          open={profilePrintOpen}
          onOpenChange={setProfilePrintOpen}
          student={studentDetails || viewStudent}
          programData={programData}
          classesData={classesData}
          sectionsData={sectionsData}
          academicSessions={academicSessions}
          feeChallans={studentFees}
          isNewlyCreated={false}
        />
      </DialogContent>
    </Dialog>
  );
};

export default StudentProfileDialog;
