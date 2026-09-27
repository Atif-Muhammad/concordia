import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
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
import usePermissions from "@/hooks/usePermissions";
import {
  createStudent,
  updateStudent,
  deleteStudent,
  getProgramNames,
  promoteStudents,
  demoteStudents,
  passoutStudents,
  expelStudents,
  struckOffStudents,
  rejoinStudent,
  getStudentById,
  getLatestRollNumbersBatch,
  getClasses,
  getSections,
  getAcademicSessions,
  getHostelRegistrations,
  getStudentFeeHistory,
} from "../../config/apis";
import {
  StudentsTableTab,
  StudentProfileDialog,
  StudentFormDialog,
  StudentPromotionDialog,
  StudentIdCardDialog,
  getStudentAcademicPath,
} from "./students/index.js";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const Students = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const { canCreate, canUpdate, canDelete } = usePermissions("Students");

  const [selectedStatus, setSelectedStatus] = useState(() => {
    if (location.state?.status) return String(location.state.status).toUpperCase();
    const seg = location.pathname.split("/").filter(Boolean)[1];
    if (seg) {
      const upper = seg.toUpperCase().replace(/-/g, "_");
      if (["ACTIVE", "GRADUATED", "EXPELLED", "STRUCK_OFF"].includes(upper)) return upper;
    }
    return "ACTIVE";
  });

  useEffect(() => {
    if (location.state?.status) {
      setSelectedStatus(String(location.state.status).toUpperCase());
      return;
    }
    const seg = location.pathname.split("/").filter(Boolean)[1];
    if (seg) {
      const upper = seg.toUpperCase().replace(/-/g, "_");
      if (["ACTIVE", "GRADUATED", "EXPELLED", "STRUCK_OFF"].includes(upper)) {
        setSelectedStatus(upper);
      }
    }
  }, [location.pathname, location.state?.status]);

  // Dialog States
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState(null);

  const [idCardOpen, setIdCardOpen] = useState(false);
  const [idCardStudent, setIdCardStudent] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promotionDialogConfig, setPromotionDialogConfig] = useState({
    initialAction: "promote_manual",
    initialSelectedIds: [],
    initialRejoinDetails: null,
    initialSessionId: "all",
  });

  // Shared Queries
  const { data: programData = [] } = useQuery({
    queryKey: ["programs-with-classes"],
    queryFn: getProgramNames,
  });

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: sectionsData = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: getAcademicSessions,
  });

  const defaultRollSessionId = useMemo(() => {
    const activeSess = academicSessions.find((s) => s.isActive) || academicSessions[0];
    return extractId(activeSess);
  }, [academicSessions]);

  const { data: rollNumberBatchData } = useQuery({
    queryKey: ["latest-roll-numbers-batch", defaultRollSessionId],
    queryFn: () => getLatestRollNumbersBatch(defaultRollSessionId),
    enabled: !!defaultRollSessionId && programData.length > 0,
  });
  const rollNumberMap = (rollNumberBatchData && typeof rollNumberBatchData === "object") ? rollNumberBatchData : {};

  const { data: allHostelRegistrationsRaw } = useQuery({
    queryKey: ["hostelRegistrations"],
    queryFn: () => getHostelRegistrations({ status: "active", limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const hostelStudentIds = useMemo(() => {
    const list = Array.isArray(allHostelRegistrationsRaw)
      ? allHostelRegistrationsRaw
      : allHostelRegistrationsRaw?.data ?? [];
    return new Set(
      list.filter((r) => r.studentId && r.status === "active").map((r) => r.studentId)
    );
  }, [allHostelRegistrationsRaw]);

  // Handle openStudentId from router state (e.g. from Hostel)
  useEffect(() => {
    if (location.state?.openStudentId) {
      const targetId = location.state.openStudentId;
      getStudentById(targetId)
        .then((student) => {
          if (student) {
            setViewStudent(student);
            setViewOpen(true);
          }
        })
        .catch(() => {});
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.openStudentId]);

  // Mutations
  const createMut = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student added successfully" });
      setFormOpen(false);
      setEditingStudent(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student updated successfully" });
      setFormOpen(false);
      setEditingStudent(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student deleted", variant: "destructive" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkPromotionMut = useMutation({
    mutationFn: async ({
      ids,
      action,
      reason,
      forcePromote = false,
      targetClassId,
      targetSectionId,
      targetProgramId,
      targetSession,
      targetSessionId,
      rejoinDetails,
    }) => {
      const fn =
        action === "promote"
          ? promoteStudents
          : action === "demote"
          ? demoteStudents
          : action === "passout"
          ? passoutStudents
          : action === "expel"
          ? expelStudents
          : action === "rejoin"
          ? (id, r) => rejoinStudent(id, r, rejoinDetails)
          : struckOffStudents;

      if (action === "promote" && !forcePromote) {
        for (const id of ids) {
          const response = await fn(
            id,
            false,
            targetClassId,
            targetSectionId,
            targetProgramId,
            targetSession,
            targetSessionId
          );

          if (response.requiresConfirmation) {
            return {
              requiresConfirmation: true,
              studentId: id,
              studentInfo: response.studentInfo,
              arrears: response.arrears,
              remainingIds: ids,
              targetClassId,
              targetSectionId,
              targetProgramId,
              targetSessionId,
              targetSession,
            };
          }
        }
        return { success: true, count: ids.length };
      }

      const promises = ids.map((id) => {
        if (action === "promote") {
          return fn(
            id,
            reason || forcePromote,
            targetClassId,
            targetSectionId,
            targetProgramId,
            targetSession,
            targetSessionId
          );
        }
        return fn(id, reason || forcePromote);
      });
      await Promise.all(promises);
      return { success: true, count: ids.length };
    },
    onSuccess: (result) => {
      if (!result?.requiresConfirmation) {
        queryClient.invalidateQueries({ queryKey: ["students"] });
        toast({ title: "Operation completed successfully" });
        setPromoteOpen(false);
      }
    },
    onError: (e) =>
      toast({
        title: "Error",
        description: e.message || "Failed to update students",
        variant: "destructive",
      }),
  });

  const openEdit = async (student) => {
    let studentToUse = student;
    const studentId = student.id || student._id;

    if (studentId) {
      try {
        const fullData = await getStudentById(studentId);
        if (fullData) {
          studentToUse = fullData;
        }
      } catch (err) {
        console.warn("Could not fetch fresh student details for edit, using existing record:", err);
      }
    }

    let docs = studentToUse.documents || {};
    if (typeof docs === "string") {
      try {
        docs = JSON.parse(docs);
      } catch {
        docs = {};
      }
    }

    const studentClassId = extractId(studentToUse.classId);
    const studentProgramId = extractId(studentToUse.programId);
    const studentSectionId = extractId(studentToUse.sectionId);
    const studentSessionId = extractId(studentToUse.sessionId);

    let rawInstallments =
      studentToUse.installments ||
      studentToUse.feeInstallments ||
      student.installments ||
      student.feeInstallments ||
      [];

    if ((!rawInstallments || rawInstallments.length === 0) && studentId) {
      try {
        const feeChallans = await getStudentFeeHistory(studentId, "INSTALLMENT");
        if (Array.isArray(feeChallans) && feeChallans.length > 0) {
          rawInstallments = feeChallans.map((c, idx) => ({
            installmentNumber: c.installmentNumber || idx + 1,
            amount: Number(c.amount) || Number(c.basePayable) || 0,
            basePayable: Number(c.basePayable) || Number(c.amount) || 0,
            dueDate: c.dueDate,
            month: c.month,
            session: typeof c.session === "object" ? c.session?.name : c.session,
            sessionId: extractId(c.sessionId) || studentSessionId,
            classId: extractId(c.classId || studentClassId),
            programId: extractId(c.programId || studentProgramId),
            status: c.status,
            paidAmount: Number(c.paidAmount || 0),
          }));
        }
      } catch (err) {
        console.warn("Could not fetch challan history fallback for edit:", err);
      }
    }

    const filteredInstallments = rawInstallments.filter((inst) => {
      const instClassId = extractId(inst.classId);
      return !instClassId || !studentClassId || instClassId === studentClassId;
    });

    const sourceInstallments =
      filteredInstallments.length > 0 ? filteredInstallments : rawInstallments;

    const installments = sourceInstallments.map((inst, idx) => {
      let dueDateStr = "";
      let monthName = "";
      if (inst.dueDate) {
        const d = new Date(inst.dueDate);
        if (!isNaN(d.getTime())) {
          dueDateStr = d.toISOString().split("T")[0];
          monthName = d.toLocaleString("default", { month: "long" });
        }
      }
      let sessionName = "";
      if (inst.session && typeof inst.session === "object" && inst.session.name) {
        sessionName = inst.session.name;
      } else if (inst.sessionId) {
        const instSessId = extractId(inst.sessionId);
        const found = Array.isArray(academicSessions)
          ? academicSessions.find((s) => extractId(s) === instSessId)
          : null;
        sessionName = found?.name || "";
      } else if (typeof inst.session === "string") {
        sessionName = inst.session;
      }
      return {
        ...inst,
        installmentNumber: inst.installmentNumber || idx + 1,
        amount: Number(inst.amount) || Number(inst.basePayable) || 0,
        basePayable: Number(inst.basePayable) || Number(inst.amount) || 0,
        totalAmount: Number(inst.totalAmount) || Number(inst.amount) || Number(inst.basePayable) || 0,
        dueDate: dueDateStr,
        month: inst.month || monthName,
        session: sessionName,
        sessionId: extractId(inst.sessionId) || studentSessionId || null,
        classId: extractId(inst.classId) || studentClassId || null,
        programId: extractId(inst.programId) || studentProgramId || null,
      };
    });

    const computedTuitionFee =
      studentToUse.tuitionFee != null && studentToUse.tuitionFee !== "" && studentToUse.tuitionFee !== 0
        ? studentToUse.tuitionFee.toString()
        : installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0).toString();

    setEditingStudent({
      ...studentToUse,
      id: studentId,
      _id: studentId,
      programId: studentProgramId,
      classId: studentClassId,
      sectionId: studentSectionId,
      sessionId: studentSessionId,
      rollNumber: (studentToUse.rollNumber ?? "").toString(),
      dob:
        studentToUse.dob && !isNaN(new Date(studentToUse.dob).getTime())
          ? new Date(studentToUse.dob).toISOString().split("T")[0]
          : "",
      admissionDate:
        studentToUse.admissionDate && !isNaN(new Date(studentToUse.admissionDate).getTime())
          ? new Date(studentToUse.admissionDate).toISOString().split("T")[0]
          : "",
      religion: studentToUse.religion || "",
      tuitionFee: computedTuitionFee,
      numberOfInstallments:
        installments.length > 0
          ? installments.length.toString()
          : (studentToUse.numberOfInstallments?.toString() || "1"),
      documents: docs,
      installments,
      feeInstallments: installments,
    });
    setFormOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <StudentsTableTab
          status={selectedStatus}
          onStatusChange={setSelectedStatus}
          programData={programData}
          classesData={classesData}
          sectionsData={sectionsData}
          academicSessions={academicSessions}
          hostelStudentIds={hostelStudentIds}
          onViewStudent={(student) => {
            setViewStudent(student);
            setViewOpen(true);
          }}
          onEditStudent={canUpdate ? openEdit : undefined}
          onDeleteStudent={canDelete ? (id) => {
            setStudentToDelete(id);
            setDeleteDialogOpen(true);
          } : undefined}
          onRejoinStudent={canUpdate ? (student) => {
            const sId = student.id || student._id;
            const sessId = extractId(student.sessionId);
            setPromotionDialogConfig({
              initialAction: "rejoin",
              initialSelectedIds: [sId],
              initialRejoinDetails: {
                sessionId: sessId,
                programId: extractId(student.programId),
                classId: extractId(student.classId),
                sectionId: extractId(student.sectionId),
                sameClass: true,
              },
              initialSessionId: sessId || "all",
            });
            setPromoteOpen(true);
          } : undefined}
          onIdCard={(student) => {
            setIdCardStudent(student);
            setIdCardOpen(true);
          }}
          onPromote={canUpdate ? () => {
            setPromotionDialogConfig({
              initialAction: "promote_manual",
              initialSelectedIds: [],
              initialRejoinDetails: null,
              initialSessionId: defaultRollSessionId || "all",
            });
            setPromoteOpen(true);
          } : undefined}
          onAddStudent={canCreate ? () => {
            setEditingStudent(null);
            setFormOpen(true);
          } : undefined}
        />

        {/* Student Form Dialog */}
        <StudentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editingStudent={editingStudent}
          programData={programData}
          classesData={classesData}
          sectionsData={sectionsData}
          academicSessions={academicSessions}
          rollNumberMap={rollNumberMap}
          onCancel={() => setFormOpen(false)}
          onSubmit={(data) => {
            const studentId = editingStudent?.id || editingStudent?._id;
            if (studentId) {
              updateMut.mutate({ id: studentId, data });
            } else {
              createMut.mutate(data);
            }
          }}
          isSubmitting={createMut.isPending || updateMut.isPending}
        />

        {/* Student Profile Dialog */}
        <StudentProfileDialog
          open={viewOpen}
          onOpenChange={setViewOpen}
          viewStudent={viewStudent}
          onEditStudent={openEdit}
          programData={programData}
          classesData={classesData}
          sectionsData={sectionsData}
          academicSessions={academicSessions}
        />

        {/* Student Promotion / Demotion / Rejoin Dialog */}
        <StudentPromotionDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          programData={programData}
          classesData={classesData}
          sectionsData={sectionsData}
          academicSessions={academicSessions}
          initialAction={promotionDialogConfig.initialAction}
          initialSelectedIds={promotionDialogConfig.initialSelectedIds}
          initialRejoinDetails={promotionDialogConfig.initialRejoinDetails}
          initialSessionId={promotionDialogConfig.initialSessionId}
          onSubmitPromotion={(payload) => bulkPromotionMut.mutateAsync(payload)}
          isSubmitting={bulkPromotionMut.isPending}
        />

        {/* Student ID Card Dialog */}
        <StudentIdCardDialog
          open={idCardOpen}
          onOpenChange={setIdCardOpen}
          student={idCardStudent}
          academicPath={
            idCardStudent
              ? getStudentAcademicPath(
                  idCardStudent,
                  programData,
                  classesData,
                  sectionsData
                )
              : "-"
          }
        />

        {/* Delete Confirmation Alert */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                student and remove their data from the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (studentToDelete) {
                    deleteMut.mutate(studentToDelete);
                    setDeleteDialogOpen(false);
                    setStudentToDelete(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Students;
