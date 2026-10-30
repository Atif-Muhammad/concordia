import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  GraduationCap,
  UserX,
  UserMinus,
  RotateCcw,
  Info,
} from "lucide-react";
import { getStudents, getPassedOutStudents, getAllStaff } from "../../../config/apis";
import { getFeeStructures } from "@/services/api";

export const StudentPromotionDialog = ({
  open,
  onOpenChange,
  programData = [],
  classesData = [],
  sectionsData = [],
  academicSessions = [],
  initialAction = "promote_manual",
  initialSelectedIds = [],
  initialRejoinDetails = null,
  initialSessionId = "all",
  onSubmitPromotion,
  isSubmitting = false,
}) => {
  const { toast } = useToast();
  const [promotionAction, setPromotionAction] = useState(initialAction);
  const isRejoinMode = promotionAction === "rejoin";
  const [selectedForPromotion, setSelectedForPromotion] = useState(initialSelectedIds);
  const [promotionReason, setPromotionReason] = useState("");

  const [dialogFilterProgram, setDialogFilterProgram] = useState(null);
  const [dialogFilterClass, setDialogFilterClass] = useState(null);
  const [dialogFilterSection, setDialogFilterSection] = useState(null);

  const activeSessionId = academicSessions.find((s) => s.isActive)?.id?.toString() ||
    (academicSessions[0] ? (academicSessions[0].id || academicSessions[0]._id)?.toString() : "all");

  const [dialogFilterSessionId, setDialogFilterSessionId] = useState(
    initialSessionId && initialSessionId !== "all" ? initialSessionId : (activeSessionId || "all")
  );

  const [promoDetails, setPromoDetails] = useState({
    sessionId: "",
    programId: "",
    classId: "",
    sectionId: "",
  });

  const [rejoinDetails, setRejoinDetails] = useState({
    sessionId: "",
    programId: "",
    classId: "",
    sectionId: "",
    sameClass: true,
    tuitionFee: "",
    isScholarship100: false,
    scholarshipStaffId: "",
    scholarshipStaffName: "",
    scholarshipAuthority: "",
    scholarshipAuthorityOther: "",
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["allStaffActive"],
    queryFn: () => getAllStaff({ status: "ACTIVE" }),
    enabled: open && isRejoinMode,
  });

  const { data: feeStructures = [] } = useQuery({
    queryKey: ["feeStructures"],
    queryFn: getFeeStructures,
    enabled: open && isRejoinMode,
  });

  const [demoteConfirmOpen, setDemoteConfirmOpen] = useState(false);
  const [arrearsConfirmDialog, setArrearsConfirmDialog] = useState({
    open: false,
    studentId: null,
    studentInfo: null,
    arrears: null,
    remainingIds: [],
    targetClassId: null,
    targetSectionId: null,
    targetProgramId: null,
    targetSessionId: null,
    targetSession: null,
  });

  useEffect(() => {
    if (open) {
      const normalizedAction = (initialAction === "promote" || initialAction === "promote_manual") ? "promote_manual" : initialAction;
      setPromotionAction(normalizedAction || "promote_manual");
      setSelectedForPromotion(initialSelectedIds || []);
      if (initialRejoinDetails) {
        setRejoinDetails(initialRejoinDetails);
        if (initialRejoinDetails.programId) setDialogFilterProgram(initialRejoinDetails.programId);
        if (initialRejoinDetails.classId) setDialogFilterClass(initialRejoinDetails.classId);
        if (initialRejoinDetails.sectionId) setDialogFilterSection(initialRejoinDetails.sectionId);
        if (initialRejoinDetails.sessionId) setDialogFilterSessionId(initialRejoinDetails.sessionId);
      }
      if (initialSessionId && initialSessionId !== "all") {
        setDialogFilterSessionId(initialSessionId);
      } else if (activeSessionId && activeSessionId !== "all") {
        setDialogFilterSessionId(activeSessionId);
      }
      if (!promoDetails.sessionId && activeSessionId && activeSessionId !== "all") {
        setPromoDetails((prev) => ({ ...prev, sessionId: activeSessionId }));
      }
    }
  }, [open, initialAction, initialSelectedIds, initialRejoinDetails, initialSessionId, activeSessionId]);

  const dialogQueryEnabled = open && !!dialogFilterProgram;
  const cleanDialogSessionId = dialogFilterSessionId === "all" ? "" : dialogFilterSessionId;

  const { data: dialogStudentsRaw = { students: [] }, isLoading: dialogStudentsLoading } = useQuery({
    queryKey: ["dialog-students", dialogFilterProgram, dialogFilterClass, dialogFilterSection, dialogFilterSessionId],
    queryFn: () => getStudents(dialogFilterProgram, dialogFilterClass, dialogFilterSection, "", "ACTIVE", "", 1, 0, "", "", cleanDialogSessionId),
    enabled: dialogQueryEnabled && !isRejoinMode,
  });

  const { data: expelledRaw = { students: [] }, isLoading: expelledLoading } = useQuery({
    queryKey: ["dialog-students-expelled", dialogFilterProgram, dialogFilterClass, dialogFilterSection, dialogFilterSessionId],
    queryFn: () => getPassedOutStudents(dialogFilterProgram, dialogFilterClass, dialogFilterSection, "", "EXPELLED", "", 1, 0, cleanDialogSessionId),
    enabled: dialogQueryEnabled && isRejoinMode,
  });

  const { data: struckOffRaw = { students: [] }, isLoading: struckOffLoading } = useQuery({
    queryKey: ["dialog-students-struckoff", dialogFilterProgram, dialogFilterClass, dialogFilterSection, dialogFilterSessionId],
    queryFn: () => getPassedOutStudents(dialogFilterProgram, dialogFilterClass, dialogFilterSection, "", "STRUCK_OFF", "", 1, 0, cleanDialogSessionId),
    enabled: dialogQueryEnabled && isRejoinMode,
  });

  const dialogStudentsData = isRejoinMode
    ? [...(Array.isArray(expelledRaw) ? expelledRaw : (expelledRaw?.students || [])), ...(Array.isArray(struckOffRaw) ? struckOffRaw : (struckOffRaw?.students || []))]
    : (Array.isArray(dialogStudentsRaw) ? dialogStudentsRaw : (dialogStudentsRaw?.students || []));

  const dialogStudentsIsLoading = isRejoinMode
    ? (expelledLoading || struckOffLoading)
    : dialogStudentsLoading;

  const extractId = (val) => {
    if (!val) return "";
    if (typeof val === "object") return (val._id || val.id || "").toString();
    return val.toString();
  };

  const selectedStudent = useMemo(() => {
    if (!isRejoinMode || !selectedForPromotion.length) return null;
    return dialogStudentsData.find((s) => extractId(s) === extractId(selectedForPromotion[0])) || null;
  }, [isRejoinMode, selectedForPromotion, dialogStudentsData]);

  useEffect(() => {
    if (isRejoinMode && selectedStudent) {
      setRejoinDetails((prev) => ({
        ...prev,
        tuitionFee: prev.tuitionFee !== "" ? prev.tuitionFee : (selectedStudent.tuitionFee?.toString() || ""),
        isScholarship100: prev.isScholarship100 ?? Boolean(selectedStudent.isScholarship100),
        scholarshipStaffId: prev.scholarshipStaffId || extractId(selectedStudent.scholarshipStaffId) || "",
        scholarshipStaffName: prev.scholarshipStaffName || selectedStudent.scholarshipStaffName || "",
        scholarshipAuthority: prev.scholarshipAuthority || selectedStudent.scholarshipAuthority || "",
        scholarshipAuthorityOther: prev.scholarshipAuthorityOther || selectedStudent.scholarshipAuthorityOther || "",
      }));
    }
  }, [isRejoinMode, selectedStudent]);

  const getClassesForProgram = (programId) => {
    if (!programId || programId === "all") return [];
    const cleanId = extractId(programId);
    return classesData.filter((c) => extractId(c.programId || c.program) === cleanId);
  };

  const getSectionsForClass = (programId, classId) => {
    if (!classId || classId === "all") return [];
    const cleanId = extractId(classId);
    const cls = classesData.find((c) => extractId(c) === cleanId);
    if (cls?.sections?.length) return cls.sections;
    return sectionsData.filter((s) => extractId(s.classId || s.class) === cleanId);
  };

  const handleApply = async () => {
    if (promotionAction === "demote") {
      setDemoteConfirmOpen(true);
      return;
    }

    const isPromoteAction = promotionAction === "promote_manual" || promotionAction === "promote";
    const payload = {
      ids: selectedForPromotion,
      action: isPromoteAction ? "promote" : promotionAction,
      reason: promotionReason,
      targetClassId: isPromoteAction ? promoDetails.classId : undefined,
      targetSectionId: isPromoteAction ? (promoDetails.sectionId === "none" ? "" : promoDetails.sectionId) : undefined,
      targetProgramId: isPromoteAction ? promoDetails.programId : undefined,
      targetSessionId: isPromoteAction ? promoDetails.sessionId : undefined,
      targetSession: isPromoteAction ? academicSessions.find(s => extractId(s) === extractId(promoDetails.sessionId))?.name : undefined,
      rejoinDetails: promotionAction === "rejoin" ? rejoinDetails : undefined,
    };

    try {
      const result = await onSubmitPromotion(payload);
      if (result?.requiresConfirmation) {
        setArrearsConfirmDialog({
          open: true,
          studentId: result.studentId,
          studentInfo: result.studentInfo,
          arrears: result.arrears,
          remainingIds: result.remainingIds,
          targetClassId: result.targetClassId,
          targetSectionId: result.targetSectionId,
          targetProgramId: result.targetProgramId,
          targetSessionId: result.targetSessionId,
          targetSession: result.targetSession,
        });
      } else {
        onOpenChange(false);
        setSelectedForPromotion([]);
        setPromotionReason("");
      }
    } catch (e) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {promotionAction.includes("promote") && <TrendingUp className="w-5 h-5" />}
              {promotionAction === "demote" && <TrendingDown className="w-5 h-5" />}
              {promotionAction === "passout" && <GraduationCap className="w-5 h-5" />}
              {promotionAction === "expel" && <UserX className="w-5 h-5 text-destructive" />}
              {promotionAction === "struck-off" && <UserMinus className="w-5 h-5 text-destructive" />}
              {promotionAction === "rejoin" && <RotateCcw className="w-5 h-5" />}
              {promotionAction === "promote_manual" ? "Promote Students" : `${promotionAction.charAt(0).toUpperCase() + promotionAction.slice(1)} Students`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label>Session</Label>
                <Select
                  value={dialogFilterSessionId}
                  onValueChange={(v) => {
                    setDialogFilterSessionId(v || "all");
                    setSelectedForPromotion([]);
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {academicSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name} {s.isActive ? "(Current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program</Label>
                <Select
                  value={dialogFilterProgram || ""}
                  onValueChange={(v) => {
                    setDialogFilterProgram(v || null);
                    setDialogFilterClass(null);
                    setDialogFilterSection(null);
                    setSelectedForPromotion([]);
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programData.map((p) => {
                      const pId = extractId(p);
                      return (
                        <SelectItem key={pId} value={pId}>
                          {p.name}{p.department?.name ? ` - ${p.department.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class</Label>
                <Select
                  value={dialogFilterClass || ""}
                  onValueChange={(v) => {
                    setDialogFilterClass(v || null);
                    setDialogFilterSection(null);
                    setSelectedForPromotion([]);
                  }}
                  disabled={!dialogFilterProgram}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={dialogFilterProgram ? "Select Class" : "Select Program First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getClassesForProgram(dialogFilterProgram).map((c) => {
                      const cId = extractId(c);
                      return (
                        <SelectItem key={cId} value={cId}>
                          {c.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Section</Label>
                <Select
                  value={dialogFilterSection || ""}
                  onValueChange={(v) => {
                    setDialogFilterSection(v || null);
                    setSelectedForPromotion([]);
                  }}
                  disabled={!dialogFilterClass}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={dialogFilterClass ? "Select Section" : "Select Class First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getSectionsForClass(dialogFilterProgram, dialogFilterClass).map((s) => {
                      const sId = extractId(s);
                      return (
                        <SelectItem key={sId} value={sId}>
                          {s.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={promotionAction.includes("promote") ? "default" : "outline"}
                onClick={() => { setPromotionAction("promote_manual"); setSelectedForPromotion([]); }}
              >
                <TrendingUp className="w-4 h-4 mr-2" /> Promote
              </Button>
              <Button
                size="sm"
                variant={promotionAction === "demote" ? "default" : "outline"}
                onClick={() => { setPromotionAction("demote"); setSelectedForPromotion([]); }}
              >
                <TrendingDown className="w-4 h-4 mr-2" /> Demote
              </Button>
              <Button
                size="sm"
                variant={promotionAction === "passout" ? "default" : "outline"}
                onClick={() => { setPromotionAction("passout"); setSelectedForPromotion([]); }}
              >
                <GraduationCap className="w-4 h-4 mr-2" /> Pass Out
              </Button>
              <Button
                size="sm"
                variant={promotionAction === "expel" ? "destructive" : "outline"}
                onClick={() => { setPromotionAction("expel"); setSelectedForPromotion([]); }}
              >
                <UserX className="w-4 h-4 mr-2" /> Expel
              </Button>
              <Button
                size="sm"
                variant={promotionAction === "struck-off" ? "destructive" : "outline"}
                onClick={() => { setPromotionAction("struck-off"); setSelectedForPromotion([]); }}
              >
                <UserMinus className="w-4 h-4 mr-2" /> Struck Off
              </Button>
              <Button
                size="sm"
                variant={promotionAction === "rejoin" ? "default" : "outline"}
                onClick={() => { setPromotionAction("rejoin"); setSelectedForPromotion([]); }}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Re-join
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 px-3 text-sm w-12">Select</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Roll</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Name</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Father/Guardian</TableHead>
                    <TableHead className="py-2 px-3 text-sm">Class</TableHead>
                    {isRejoinMode && <TableHead className="py-2 px-3 text-sm">Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogStudentsIsLoading && (
                    <TableRow>
                      <TableCell colSpan={isRejoinMode ? 6 : 5} className="text-center py-4 text-muted-foreground">
                        Loading students...
                      </TableCell>
                    </TableRow>
                  )}
                  {!dialogStudentsIsLoading && dialogStudentsData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isRejoinMode ? 6 : 5} className="text-center py-4 text-muted-foreground">
                        {dialogFilterProgram
                          ? (isRejoinMode ? "No expelled or struck-off students found for this filter" : "No active students found for this filter")
                          : "Select a program to load students"}
                      </TableCell>
                    </TableRow>
                  )}
                  {dialogStudentsData.map((s) => {
                    const sId = (s.id || s._id || "").toString();
                    const isChecked = selectedForPromotion.map(String).includes(sId);
                    const matchingClass = classesData.find((c) => extractId(c) === extractId(s.classId));
                    return (
                      <TableRow key={sId}>
                        <TableCell className="py-2 px-3 text-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForPromotion([...selectedForPromotion, sId]);
                              } else {
                                setSelectedForPromotion(selectedForPromotion.filter((id) => id?.toString() !== sId));
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell className="py-2 px-3 text-sm">{s.rollNumber}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{s.fName} {s.lName}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">{s.fatherOrguardian}</TableCell>
                        <TableCell className="py-2 px-3 text-sm">
                          {matchingClass?.name || s.class?.name || s.className || "-"}
                        </TableCell>
                        {isRejoinMode && (
                          <TableCell className="py-2 px-3 text-sm">
                            <Badge variant={s.status === "EXPELLED" ? "destructive" : "secondary"}>
                              {s.status === "EXPELLED" ? "Expelled" : "Struck Off"}
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Manual Promotion Destination Details */}
            {(promotionAction === "promote_manual" || promotionAction === "promote") && (
              <div className="space-y-4 p-4 bg-orange-50 border border-orange-100 rounded-lg animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  <h4 className="text-sm font-semibold text-orange-900">Destination Placement</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Target Session *</Label>
                    <Select
                      value={promoDetails.sessionId}
                      onValueChange={(v) => setPromoDetails((prev) => ({ ...prev, sessionId: v }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select Session" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicSessions.map((s) => {
                          const sId = extractId(s);
                          return (
                            <SelectItem key={sId} value={sId}>
                              {s.name} {s.isActive ? "(Current)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Program *</Label>
                    <Select
                      value={promoDetails.programId}
                      onValueChange={(v) => setPromoDetails((prev) => ({ ...prev, programId: v, classId: "", sectionId: "" }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select Program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programData.map((p) => {
                          const pId = extractId(p);
                          return (
                            <SelectItem key={pId} value={pId}>
                              {p.name}{p.department?.name ? ` - ${p.department.name}` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Class *</Label>
                    <Select
                      value={promoDetails.classId}
                      onValueChange={(v) => setPromoDetails((prev) => ({ ...prev, classId: v, sectionId: "" }))}
                      disabled={!promoDetails.programId}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={promoDetails.programId ? "Select Class" : "Select Program First"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getClassesForProgram(promoDetails.programId).map((c) => {
                          const cId = extractId(c);
                          return (
                            <SelectItem key={cId} value={cId}>
                              {c.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Section (Optional)</Label>
                    <Select
                      value={promoDetails.sectionId}
                      onValueChange={(v) => setPromoDetails((prev) => ({ ...prev, sectionId: v === "none" ? "" : v }))}
                      disabled={!promoDetails.classId}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Section</SelectItem>
                        {getSectionsForClass(promoDetails.programId, promoDetails.classId).map((s) => {
                          const sId = extractId(s);
                          return (
                            <SelectItem key={sId} value={sId}>
                              {s.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-orange-700 italic">
                  Note: Manual promotion will override standard class sequence and regenerate the financial installment plan.
                </p>
              </div>
            )}

            {/* Rejoin Placement Details */}
            {promotionAction === "rejoin" && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rejoinSameClass"
                    checked={rejoinDetails.sameClass}
                    onChange={(e) => setRejoinDetails((prev) => ({ ...prev, sameClass: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="rejoinSameClass" className="text-blue-900 font-semibold cursor-pointer">
                    Re-join to same class/session (No new installments)
                  </Label>
                </div>

                {!rejoinDetails.sameClass && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div className="col-span-1 md:col-span-2">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">New Placement Details</h4>
                    </div>
                    <div>
                      <Label>Session *</Label>
                      <Select
                        value={rejoinDetails.sessionId}
                        onValueChange={(v) => setRejoinDetails((prev) => ({ ...prev, sessionId: v }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                          {academicSessions.map((s) => {
                            const sId = extractId(s);
                            return (
                              <SelectItem key={sId} value={sId}>
                                {s.name} {s.isActive ? "(Current)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Program *</Label>
                      <Select
                        value={rejoinDetails.programId}
                        onValueChange={(v) => setRejoinDetails((prev) => ({ ...prev, programId: v, classId: "", sectionId: "" }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Program" />
                        </SelectTrigger>
                        <SelectContent>
                          {programData.map((p) => {
                            const pId = extractId(p);
                            return (
                              <SelectItem key={pId} value={pId}>
                                {p.name}{p.department?.name ? ` - ${p.department.name}` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Class *</Label>
                      <Select
                        value={rejoinDetails.classId}
                        onValueChange={(v) => setRejoinDetails((prev) => ({ ...prev, classId: v, sectionId: "" }))}
                        disabled={!rejoinDetails.programId}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                          {getClassesForProgram(rejoinDetails.programId).map((c) => {
                            const cId = extractId(c);
                            return (
                              <SelectItem key={cId} value={cId}>
                                {c.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Section (Optional)</Label>
                      <Select
                        value={rejoinDetails.sectionId}
                        onValueChange={(v) => setRejoinDetails((prev) => ({ ...prev, sectionId: v === "none" ? "" : v }))}
                        disabled={!rejoinDetails.classId}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Section</SelectItem>
                          {getSectionsForClass(rejoinDetails.programId, rejoinDetails.classId).map((s) => {
                            const sId = extractId(s);
                            return (
                              <SelectItem key={sId} value={sId}>
                                {s.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Fee Structure & Agreed Tuition Fee Section */}
                {(() => {
                  const targetRejoinClassId = rejoinDetails.sameClass
                    ? (selectedStudent?.classId?._id || selectedStudent?.classId)
                    : rejoinDetails.classId;

                  const targetClassFs = (Array.isArray(feeStructures) ? feeStructures : []).find(
                    (fs) => extractId(fs.classId || fs.class) === extractId(targetRejoinClassId)
                  );
                  const targetStdFee = targetClassFs?.totalAmount || 0;

                  const alreadyPaidAmt = (selectedStudent?.installments || []).reduce(
                    (sum, inst) => sum + (Number(inst.paidAmount) || 0),
                    0
                  );

                  const agreedFeeVal = Number(rejoinDetails.tuitionFee) || 0;
                  const remainingFeeBalance = Math.max(0, agreedFeeVal - alreadyPaidAmt);

                  return (
                    <div className="pt-3 border-t border-blue-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-blue-900">
                          Fee Structure & Agreed Tuition Fee
                        </h4>
                        {targetStdFee > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                            Class Standard: Rs. {targetStdFee}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-semibold text-blue-950">Agreed Tuition Fee (Rs.)</Label>
                          <Input
                            type="number"
                            disabled={rejoinDetails.isScholarship100}
                            value={rejoinDetails.isScholarship100 ? 0 : rejoinDetails.tuitionFee}
                            onChange={(e) => {
                              if (rejoinDetails.isScholarship100) return;
                              setRejoinDetails((prev) => ({ ...prev, tuitionFee: e.target.value }));
                            }}
                            placeholder={targetStdFee ? String(targetStdFee) : "Enter agreed tuition fee"}
                            className={`bg-white text-xs h-9 font-semibold ${rejoinDetails.isScholarship100 ? "bg-muted/50 text-emerald-700 cursor-not-allowed" : ""}`}
                          />
                          {rejoinDetails.isScholarship100 && (
                            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span>Challans will be generated with standard installment amounts and equal discount applied for proper trails in reports.</span>
                            </p>
                          )}
                        </div>

                        {/* Financial status summary */}
                        <div className="p-2.5 bg-blue-100/60 rounded-md text-xs space-y-1 text-blue-900 border border-blue-200">
                          <div className="flex justify-between">
                            <span className="text-blue-700">Already Paid (Locked):</span>
                            <span className="font-bold font-mono">Rs. {alreadyPaidAmt}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">New Agreed Fee:</span>
                            <span className="font-bold font-mono">Rs. {agreedFeeVal}</span>
                          </div>
                          <div className="flex justify-between border-t border-blue-200 pt-1 font-bold">
                            <span>Remaining to Collect:</span>
                            <span className="text-emerald-700 font-mono">Rs. {remainingFeeBalance}</span>
                          </div>
                        </div>
                      </div>

                      {/* 100% Scholarship Toggle for Rejoin */}
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rejoinDetails.isScholarship100}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRejoinDetails((prev) => ({
                                ...prev,
                                isScholarship100: checked,
                                tuitionFee: checked ? "0" : (targetStdFee ? String(targetStdFee) : prev.tuitionFee),
                                scholarshipStaffId: checked ? prev.scholarshipStaffId : "",
                                scholarshipAuthority: checked ? prev.scholarshipAuthority : "",
                                scholarshipAuthorityOther: checked ? prev.scholarshipAuthorityOther : "",
                              }));
                            }}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-bold text-emerald-900">
                            Re-admit under 100% Scholarship (Full Concession)
                          </span>
                        </label>

                        {rejoinDetails.isScholarship100 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-emerald-200">
                            <div>
                              <Label className="text-[11px] font-semibold text-emerald-950">Staff Member (Optional)</Label>
                              <Select
                                value={rejoinDetails.scholarshipStaffId || "none"}
                                onValueChange={(val) => {
                                  const sId = val === "none" ? "" : val;
                                  const matched = (Array.isArray(staffList) ? staffList : []).find((s) => extractId(s) === sId);
                                  setRejoinDetails((prev) => ({
                                    ...prev,
                                    scholarshipStaffId: sId,
                                    scholarshipStaffName: matched?.name ? `${matched.name} (${matched.staffId || ""})` : "",
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white text-xs h-8">
                                  <SelectValue placeholder="Select Staff Member" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None / Direct Word</SelectItem>
                                  {(Array.isArray(staffList) ? staffList : []).map((staff) => {
                                    const id = extractId(staff);
                                    return (
                                      <SelectItem key={id} value={id}>
                                        {staff.name} {staff.staffId ? `(${staff.staffId})` : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-[11px] font-semibold text-emerald-950">Authority (Optional)</Label>
                              <Select
                                value={rejoinDetails.scholarshipAuthority || "none"}
                                onValueChange={(val) => {
                                  const aVal = val === "none" ? "" : val;
                                  setRejoinDetails((prev) => ({
                                    ...prev,
                                    scholarshipAuthority: aVal,
                                    scholarshipAuthorityOther: aVal === "Others" ? prev.scholarshipAuthorityOther : "",
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-white text-xs h-8">
                                  <SelectValue placeholder="Select Authority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None / Standard</SelectItem>
                                  <SelectItem value="WWF">WWF (Workers Welfare Fund)</SelectItem>
                                  <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                              </Select>
                              {rejoinDetails.scholarshipAuthority === "Others" && (
                                <Input
                                  placeholder="Specify Authority details..."
                                  className="mt-1 text-xs bg-white h-7"
                                  value={rejoinDetails.scholarshipAuthorityOther}
                                  onChange={(e) => setRejoinDetails((prev) => ({ ...prev, scholarshipAuthorityOther: e.target.value }))}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Reason input for expel, struck-off, rejoin */}
            {(promotionAction === "expel" || promotionAction === "struck-off" || promotionAction === "rejoin") && (
              <div className="space-y-2">
                <Label>Reason (Required)</Label>
                <Textarea
                  placeholder={`Enter reason for ${promotionAction === "expel" ? "expulsion" : promotionAction === "struck-off" ? "striking off" : "re-joining"}...`}
                  value={promotionReason}
                  onChange={(e) => setPromotionReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t mt-4 shrink-0">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  onOpenChange(false);
                  setSelectedForPromotion([]);
                  setPromotionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleApply}
                disabled={
                  isSubmitting ||
                  selectedForPromotion.length === 0 ||
                  ((promotionAction === "expel" || promotionAction === "struck-off" || promotionAction === "rejoin") && !promotionReason.trim()) ||
                  (promotionAction === "rejoin" && !rejoinDetails.sameClass && (!rejoinDetails.sessionId || !rejoinDetails.programId || !rejoinDetails.classId)) ||
                  ((promotionAction === "promote_manual" || promotionAction === "promote") && (!promoDetails.sessionId || !promoDetails.programId || !promoDetails.classId))
                }
              >
                {isSubmitting ? "Processing..." : `Apply (${selectedForPromotion.length} selected)`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Arrears Confirmation Dialog */}
      <AlertDialog
        open={arrearsConfirmDialog.open}
        onOpenChange={(openVal) =>
          !openVal && setArrearsConfirmDialog({ open: false, studentId: null, studentInfo: null, arrears: null, remainingIds: [] })
        }
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Student Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              {arrearsConfirmDialog.studentInfo && (
                <div className="space-y-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p><strong>Roll:</strong> {arrearsConfirmDialog.studentInfo.rollNumber}</p>
                    <p><strong>Name:</strong> {arrearsConfirmDialog.studentInfo.name}</p>
                  </div>
                  <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                    <div className="font-semibold text-destructive mb-2 flex items-center gap-2">
                      <div className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
                      Outstanding Fees (Current Session)
                    </div>
                    <p className="text-sm">
                      <strong>Program / Class / Section:</strong>{" "}
                      {[arrearsConfirmDialog.arrears?.programName, arrearsConfirmDialog.arrears?.className, arrearsConfirmDialog.arrears?.sectionName].filter(Boolean).join(" / ") || "-"}
                    </p>

                    {arrearsConfirmDialog.arrears?.unpaidInstallments?.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2 border-border">
                        <p className="text-[10px] uppercase font-black text-destructive/60 mb-1">Unpaid Installments</p>
                        {arrearsConfirmDialog.arrears.unpaidInstallments.map((c, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Inst. #{c.installmentNumber} ({c.status})</span>
                            <span className="font-medium text-destructive">PKR {c.balance?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-lg font-bold text-destructive mt-3 flex justify-between items-center border-t pt-2 border-border">
                      <span className="text-sm uppercase">Total Backlog</span>
                      <span>PKR {arrearsConfirmDialog.arrears?.outstandingAmount?.toLocaleString()}</span>
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unpaid fees will remain in this class history. Continue with promotion?
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await onSubmitPromotion({
                    ids: arrearsConfirmDialog.remainingIds || [arrearsConfirmDialog.studentId],
                    action: "promote",
                    forcePromote: true,
                    targetClassId: arrearsConfirmDialog.targetClassId,
                    targetSectionId: arrearsConfirmDialog.targetSectionId,
                    targetProgramId: arrearsConfirmDialog.targetProgramId,
                    targetSessionId: arrearsConfirmDialog.targetSessionId,
                    targetSession: arrearsConfirmDialog.targetSession,
                  });
                  toast({ title: "Student promoted" });
                  setArrearsConfirmDialog({ open: false, studentId: null, studentInfo: null, arrears: null, remainingIds: [] });
                  onOpenChange(false);
                } catch (error) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Promote Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote Confirmation Alert */}
      <AlertDialog open={demoteConfirmOpen} onOpenChange={setDemoteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <TrendingDown className="h-5 w-5" /> Confirm Demotion
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-semibold text-foreground">
                You are about to demote {selectedForPromotion.length} student(s) to the previous class.
              </p>
              <div className="bg-destructive/10 border border-border p-3 rounded-lg text-sm text-destructive">
                <p className="font-bold mb-1">⚠️ Warning: Challan Deletion</p>
                <p>
                  Any <strong>unpaid challans</strong> associated with their current class will be
                  <strong> permanently deleted</strong> to prevent incorrect arrears, effectively resetting their financial record for this class.
                </p>
              </div>
              <p>This action cannot be automatically undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDemoteConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setDemoteConfirmOpen(false);
                try {
                  await onSubmitPromotion({
                    ids: selectedForPromotion,
                    action: "demote",
                    reason: promotionReason,
                  });
                  onOpenChange(false);
                  setSelectedForPromotion([]);
                  setPromotionReason("");
                } catch (e) {
                  toast({ title: "Demotion Failed", description: e.message, variant: "destructive" });
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Demote &amp; Delete Challans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StudentPromotionDialog;
