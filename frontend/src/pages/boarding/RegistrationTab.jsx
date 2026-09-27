import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHostelRegistrations,
  getHostelRegistrationHistory,
  getHostelChallansDedicated,
  createHostelRegistration,
  updateHostelRegistration,
  deleteHostelRegistration,
  terminateHostelRegistration,
  withdrawHostelRegistration,
  readmitHostelRegistration,
  getRooms,
  allocateRoom,
  deallocateStudent,
  searchStudents,
} from "@/services/api";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import {
  Search,
  UserPlus,
  Edit,
  UserX,
  LogOut,
  RotateCcw,
  Eye,
  ExternalLink,
  X,
  Loader2,
  Trash2,
} from "lucide-react";

function getLastTerminationReason(terminationReason) {
  if (!terminationReason) return null;
  try {
    const arr = JSON.parse(terminationReason);
    if (Array.isArray(arr)) {
      const last = [...arr].reverse().find(e => e.action === 'terminated' && e.reason);
      return last?.reason || null;
    }
  } catch {}
  return terminationReason;
}

function RegistrationHistoryTab({ regId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['hostelRegHistory', regId],
    queryFn: () => getHostelRegistrationHistory(regId),
    enabled: !!regId,
  });

  const actionMeta = {
    registered:  { label: 'Registered',  color: 'bg-green-100 text-green-700' },
    terminated:  { label: 'Terminated',  color: 'bg-red-100 text-red-700' },
    withdrawn:   { label: 'Withdrawn',   color: 'bg-gray-100 text-gray-700' },
    readmitted:  { label: 'Readmitted',  color: 'bg-blue-100 text-blue-700' },
  };

  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (!history.length) return <p className="text-sm text-muted-foreground text-center py-6">No history yet.</p>;

  return (
    <div className="relative pl-4 space-y-0 max-h-72 overflow-y-auto">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
      {[...history].reverse().map((entry, i) => {
        const meta = actionMeta[entry.action] || { label: entry.action, color: 'bg-muted text-muted-foreground' };
        return (
          <div key={i} className="relative flex gap-3 pb-4">
            <div className="mt-1 w-3 h-3 rounded-full border-2 border-background bg-primary shrink-0 z-10" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
                {entry.previousStatus && (
                  <span className="text-[10px] text-muted-foreground">from {entry.previousStatus}</span>
                )}
              </div>
              {entry.reason && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.reason}"</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RegistrationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = usePermissions("Boarding", "registration");

  // Registration filters
  const [regSearch, setRegSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");
  const [regTypeFilter, setRegTypeFilter] = useState("all");
  const scrollSentinelRef = useRef(null);

  const {
    data: regPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: regLoading,
  } = useInfiniteQuery({
    queryKey: ['hostelRegistrations', regSearch, regStatusFilter, regTypeFilter],
    queryFn: ({ pageParam = 1 }) => getHostelRegistrations({
      search: regSearch || undefined,
      status: regStatusFilter !== 'all' ? regStatusFilter : undefined,
      type: regTypeFilter !== 'all' ? regTypeFilter : undefined,
      page: pageParam,
      limit: 20,
    }),
    getNextPageParam: (lastPage) => lastPage?.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const hostelRegistrations = regPages?.pages.flatMap(p => Array.isArray(p?.data) ? p.data : (Array.isArray(p) ? p : [])) ?? [];

  // Infinite scroll observer
  useEffect(() => {
    const el = scrollSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  // UI State
  const [regOpen, setRegOpen] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // Terminate / Withdraw / Readmit state
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReg, setTerminateReg] = useState(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReg, setWithdrawReg] = useState(null);
  const [readmitOpen, setReadmitOpen] = useState(false);
  const [readmitReg, setReadmitReg] = useState(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isReadmitting, setIsReadmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Student search state
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [registrationType, setRegistrationType] = useState("internal"); // "internal" or "external"

  const [regFormData, setRegFormData] = useState({
    studentId: "",
    externalName: "",
    externalInstitute: "",
    externalGuardianName: "",
    externalGuardianNumber: "",
    guardianCnic: "",
    studentCnic: "",
    address: "",
    decidedFeePerMonth: "",
    registrationDate: new Date().toISOString().split("T")[0],
    roomId: ""
  });

  // External student profile dialog state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileReg, setProfileReg] = useState(null);

  // Challans for the profile dialog
  const { data: profileChallansResponse } = useQuery({
    queryKey: ['hostelChallans', profileReg?.id],
    queryFn: () => getHostelChallansDedicated({ registrationId: profileReg.id }),
    enabled: !!profileReg?.id,
  });
  const profileChallans = Array.isArray(profileChallansResponse)
    ? profileChallansResponse
    : Array.isArray(profileChallansResponse?.data)
    ? profileChallansResponse.data
    : [];

  // Search students using API with debouncing
  useEffect(() => {
    const searchDebounce = setTimeout(async () => {
      if (studentSearch && studentSearch.length >= 2) {
        setSearchLoading(true);
        try {
          const results = await searchStudents(studentSearch);
          setSearchResults(results.slice(0, 10));
        } catch (error) {
          console.error('Student search failed:', error);
          setSearchResults([]);
        }
        setSearchLoading(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchDebounce);
  }, [studentSearch]);

  const handleStudentSelect = (student) => {
    const studentId = student.id || student._id;
    const isRegistered = hostelRegistrations.some(reg => {
      const regStudId = reg.studentId?._id || reg.studentId;
      return String(regStudId) === String(studentId) && reg.id !== editMode.reg;
    });
    if (isRegistered) {
      toast({ title: "Student is already registered", variant: "destructive" });
      return;
    }
    setSelectedStudent(student);
    setStudentSearch(`${student.fName} ${student.lName || ''} (${student.rollNumber})`);
    setRegFormData(prev => ({ ...prev, studentId: String(studentId) }));
    setShowStudentDropdown(false);
    setSearchResults([]);
  };

  const clearStudentSelection = () => {
    setSelectedStudent(null);
    setStudentSearch("");
    setRegFormData({
      studentId: "",
      externalName: "",
      externalInstitute: "",
      externalGuardianName: "",
      externalGuardianNumber: "",
      guardianCnic: "",
      studentCnic: "",
      address: "",
      decidedFeePerMonth: "",
      registrationDate: new Date().toISOString().split("T")[0],
      roomId: ""
    });
    setSearchResults([]);
  };

  const handleAddRegistration = async () => {
    if (registrationType === "internal" && !regFormData.studentId) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    if (registrationType === "external" && !regFormData.externalName?.trim()) {
      toast({ title: "Please enter student name", variant: "destructive" });
      return;
    }
    if (!regFormData.roomId) {
      toast({ title: "Please select a room", variant: "destructive" });
      return;
    }
    if (regFormData.decidedFeePerMonth === "" || Number(regFormData.decidedFeePerMonth) < 0) {
      toast({ title: "Please enter a valid monthly fee", variant: "destructive" });
      return;
    }
    if (registrationType === "external" && !regFormData.guardianCnic?.trim()) {
      toast({ title: "Please enter guardian CNIC", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMode.reg) {
        const updateData = {
          registrationType,
          registrationDate: regFormData.registrationDate,
          studentId: registrationType === "internal" ? regFormData.studentId : null,
          externalName: registrationType === "external" ? regFormData.externalName.trim() : null,
          externalInstitute: registrationType === "external" ? (regFormData.externalInstitute?.trim() || null) : null,
          externalGuardianName: registrationType === "external" ? (regFormData.externalGuardianName?.trim() || null) : null,
          externalGuardianNumber: registrationType === "external" ? (regFormData.externalGuardianNumber?.trim() || null) : null,
          decidedFeePerMonth: Number(regFormData.decidedFeePerMonth || 0),
          roomId: regFormData.roomId || null,
          ...(registrationType === "external" && {
            guardianCnic: regFormData.guardianCnic?.trim() || null,
            studentCnic: regFormData.studentCnic?.trim() || null,
            address: regFormData.address?.trim() || null,
          }),
        };

        await updateHostelRegistration(editMode.reg, updateData);

        const studentId = registrationType === "internal" ? regFormData.studentId : null;
        const externalName = registrationType === "external" ? regFormData.externalName.trim() : null;

        const currentRoom = rooms.find(r =>
          r.allocations?.some(alloc =>
            studentId ? String(alloc.studentId) === String(studentId) : (externalName && alloc.externalName === externalName)
          )
        );

        if (currentRoom && String(currentRoom.id) !== String(regFormData.roomId)) {
          const oldAllocation = currentRoom.allocations.find(alloc =>
            studentId ? String(alloc.studentId) === String(studentId) : (externalName && alloc.externalName === externalName)
          );
          if (oldAllocation) {
            await deallocateStudent(oldAllocation.id);
          }

          await allocateRoom({
            roomId: regFormData.roomId,
            studentId: studentId,
            externalName: externalName,
            allocationDate: regFormData.registrationDate
          });
        } else if (!currentRoom && regFormData.roomId) {
          await allocateRoom({
            roomId: regFormData.roomId,
            studentId: studentId,
            externalName: externalName,
            allocationDate: regFormData.registrationDate
          });
        }

        toast({ title: "Registration updated" });
      } else {
        const registrationData = {
          hostelName: "Main Hostel",
          registrationType,
          registrationDate: regFormData.registrationDate,
          status: "active",
          decidedFeePerMonth: Number(regFormData.decidedFeePerMonth || 0),
          roomId: regFormData.roomId || null,
          ...(registrationType === "external" && {
            guardianCnic: regFormData.guardianCnic?.trim() || null,
            studentCnic: regFormData.studentCnic?.trim() || null,
            address: regFormData.address?.trim() || null,
          }),
        };

        if (registrationType === "internal") {
          registrationData.studentId = regFormData.studentId;
        } else {
          registrationData.externalName = regFormData.externalName.trim();
          registrationData.externalInstitute = regFormData.externalInstitute?.trim() || '';
          registrationData.externalGuardianName = regFormData.externalGuardianName?.trim() || '';
          registrationData.externalGuardianNumber = regFormData.externalGuardianNumber?.trim() || '';
        }

        const createdReg = await createHostelRegistration(registrationData);

        const allocationData = {
          roomId: regFormData.roomId,
          registrationId: createdReg?.id || createdReg?._id,
          allocationDate: regFormData.registrationDate
        };

        if (registrationType === "internal") {
          allocationData.studentId = regFormData.studentId;
        } else {
          allocationData.externalName = regFormData.externalName.trim();
        }

        await allocateRoom(allocationData);

        toast({ title: "Student registered and room allocated" });
      }

      queryClient.invalidateQueries({ queryKey: ['hostelRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      setRegOpen(false);
      setEditMode({});
      clearStudentSelection();
      setRegFormData({
        studentId: "",
        externalName: "",
        externalInstitute: "",
        externalGuardianName: "",
        externalGuardianNumber: "",
        guardianCnic: "",
        studentCnic: "",
        address: "",
        decidedFeePerMonth: "",
        registrationDate: new Date().toISOString().split("T")[0],
        roomId: ""
      });
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to save registration", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStudentRoom = (studentId, externalName) => {
    return rooms.find(r =>
      r.allocations?.some(alloc =>
        studentId ? String(alloc.studentId) === String(studentId) : (externalName && alloc.externalName === externalName)
      )
    );
  };

  const executeDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      const studentRoom = rooms.find(r =>
        r.allocations?.some(alloc =>
          deleteItem.studentId ? String(alloc.studentId) === String(deleteItem.studentId) : alloc.externalName === deleteItem.externalName
        )
      );
      if (studentRoom) {
        const allocation = studentRoom.allocations.find(alloc =>
          deleteItem.studentId ? String(alloc.studentId) === String(deleteItem.studentId) : alloc.externalName === deleteItem.externalName
        );
        if (allocation) await deallocateStudent(allocation.id);
      }
      await deleteHostelRegistration(deleteItem.id);
      queryClient.invalidateQueries({ queryKey: ['hostelRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({ title: "Deleted successfully" });
      setDeleteConfirmOpen(false);
      setDeleteItem(null);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Failed to delete registration", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Boarding Registration</CardTitle>
            {canCreate && (
              <Button onClick={() => {
                setRegOpen(true);
                clearStudentSelection();
              }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Registration
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll number, ID..."
                value={regSearch}
                onChange={e => setRegSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regTypeFilter} onValueChange={setRegTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm">Student Name</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Roll Number</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Program</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Room</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Registration Date</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Status</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : hostelRegistrations.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No registrations found.</TableCell></TableRow>
                ) : hostelRegistrations.map(reg => {
                  const studentRoom = getStudentRoom(reg.studentId, reg.externalName);
                  const studentName = reg.student ? `${reg.student.fName} ${reg.student.lName || ''}` : reg.externalName;
                  const rollNumber = reg.student?.rollNumber || "External";
                  const program = reg.student?.program?.name || reg.externalInstitute || "N/A";

                  return (
                    <TableRow key={reg.id}>
                      <TableCell className="py-2 px-3 text-sm font-medium">{studentName}</TableCell>
                      <TableCell className="py-2 px-3 text-sm">{rollNumber}</TableCell>
                      <TableCell className="py-2 px-3 text-sm">{program}</TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        {studentRoom ? (
                          <span className="text-sm">
                            Room {studentRoom.roomNumber}
                            <span className="text-muted-foreground ml-1">
                              ({studentRoom.currentOccupancy}/{studentRoom.capacity})
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">{reg.registrationDate?.split("T")[0]}</TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={reg.status === "active" ? "default" : reg.status === "terminated" ? "destructive" : "secondary"}>
                            {reg.status}
                          </Badge>
                          {reg.status === "terminated" && reg.terminationReason && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={getLastTerminationReason(reg.terminationReason)}>
                              {getLastTerminationReason(reg.terminationReason)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setProfileReg(reg);
                                setProfileOpen(true);
                              }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Profile</TooltipContent>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={() => {
                                  setEditMode({ reg: reg.id });
                                  const isInternal = reg.registrationType ? reg.registrationType === "internal" : !!(reg.studentId || reg.student);
                                  setRegistrationType(isInternal ? "internal" : "external");

                                  const studentIdVal = reg.student?._id || reg.studentId?._id || reg.studentId || "";
                                  const curRoom = getStudentRoom(studentIdVal, reg.externalName);
                                  const curRoomId = curRoom?.id || (typeof reg.roomId === 'object' ? reg.roomId?._id : reg.roomId) || "";

                                  setRegFormData({
                                    studentId: studentIdVal ? String(studentIdVal) : "",
                                    externalName: reg.externalName || "",
                                    externalInstitute: reg.externalInstitute || "",
                                    externalGuardianName: reg.externalGuardianName || "",
                                    externalGuardianNumber: reg.externalGuardianNumber || "",
                                    guardianCnic: reg.guardianCnic || "",
                                    studentCnic: reg.studentCnic || "",
                                    address: reg.address || "",
                                    decidedFeePerMonth: reg.decidedFeePerMonth != null ? String(reg.decidedFeePerMonth) : "",
                                    registrationDate: reg.registrationDate ? reg.registrationDate.split("T")[0] : new Date().toISOString().split("T")[0],
                                    roomId: curRoomId ? String(curRoomId) : ""
                                  });
                                  if (reg.student) {
                                    setStudentSearch(`${reg.student.fName} ${reg.student.lName || ''} (${reg.student.rollNumber})`);
                                    setSelectedStudent(reg.student);
                                  } else {
                                    setSelectedStudent(null);
                                    setStudentSearch("");
                                  }
                                  setRegOpen(true);
                                }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  disabled={reg.status === 'terminated' || reg.status === 'withdrawn'}
                                  onClick={() => { setTerminateReg(reg); setTerminateReason(""); setTerminateOpen(true); }}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Terminate (expelled)</TooltipContent>
                            </Tooltip>
                          )}
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                  disabled={reg.status === 'terminated' || reg.status === 'withdrawn'}
                                  onClick={() => { setWithdrawReg(reg); setWithdrawOpen(true); }}>
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Withdraw (checked out)</TooltipContent>
                            </Tooltip>
                          )}
                          {(reg.status === 'terminated' || reg.status === 'withdrawn') && canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => { setReadmitReg(reg); setReadmitOpen(true); }}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Readmit</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                  setDeleteItem(reg);
                                  setDeleteConfirmOpen(true);
                                }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Registration</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div ref={scrollSentinelRef} className="py-2 flex justify-center">
              {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {!hasNextPage && hostelRegistrations.length > 0 && (
                <span className="text-xs text-muted-foreground">All registrations loaded ({hostelRegistrations.length})</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration Dialog */}
      <Dialog open={regOpen} onOpenChange={open => {
        setRegOpen(open);
        if (!open) {
          setEditMode({});
          clearStudentSelection();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editMode.reg ? "Edit Boarding Registration" : "New Boarding Registration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editMode.reg && (
              <div className="flex bg-muted p-1 rounded-lg">
                <button
                  className={cn(
                    "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                    registrationType === "internal" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                  onClick={() => { setRegistrationType("internal"); clearStudentSelection(); }}
                >
                  Internal Student
                </button>
                <button
                  className={cn(
                    "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                    registrationType === "external" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                  onClick={() => { setRegistrationType("external"); clearStudentSelection(); }}
                >
                  External Student
                </button>
              </div>
            )}
            {editMode.reg && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-1 rounded bg-muted font-medium text-foreground">
                  {registrationType === "internal" ? "Internal Student" : "External Student"}
                </span>
                <span className="text-xs">— type cannot be changed after registration</span>
              </div>
            )}

            {registrationType === "internal" ? (
              editMode.reg ? (
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-muted/40">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {selectedStudent ? `${selectedStudent.fName} ${selectedStudent.lName || ''}`.trim() : "Internal Student"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedStudent ? `Roll: ${selectedStudent.rollNumber}${selectedStudent.program?.name ? ` · ${selectedStudent.program.name}` : ''}` : `ID: ${regFormData.studentId}`}
                      </div>
                    </div>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Locked</span>
                  </div>
                </div>
              ) : (
                <div className="relative space-y-0">
                  <Label>Search Student (by name or roll number)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type to search..."
                      value={studentSearch}
                      onChange={e => { setStudentSearch(e.target.value); setShowStudentDropdown(true); }}
                      onFocus={() => setShowStudentDropdown(true)}
                      className="pl-9 pr-9"
                    />
                    {studentSearch && (
                      <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={clearStudentSelection}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {showStudentDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
                      {searchLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>}
                      {!searchLoading && searchResults.map(student => {
                        const studentId = student.id || student._id;
                        const isRegistered = hostelRegistrations.some(reg => {
                          const regStudId = reg.studentId?._id || reg.studentId;
                          return String(regStudId) === String(studentId) && reg.id !== editMode.reg;
                        });
                        return (
                          <div
                            key={student.id}
                            className={`px-3 py-2 border-b last:border-b-0 ${isRegistered ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent cursor-pointer'}`}
                            onClick={() => !isRegistered && handleStudentSelect(student)}
                          >
                            <div className="font-medium flex justify-between">
                              <span>{student.fName} {student.lName}</span>
                              {isRegistered && <span className="text-xs text-red-500 font-normal">Already Registered</span>}
                            </div>
                            <div className="text-sm text-muted-foreground">Roll: {student.rollNumber} • {student.program?.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {showStudentDropdown && !searchLoading && studentSearch.length >= 2 && searchResults.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
                      No students found
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Student Name" value={regFormData.externalName} onChange={e => setRegFormData({ ...regFormData, externalName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Institute/Organization</Label>
                  <Input placeholder="Institute Name" value={regFormData.externalInstitute} onChange={e => setRegFormData({ ...regFormData, externalInstitute: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Parent/Guardian Name</Label>
                  <Input placeholder="Guardian Name" value={regFormData.externalGuardianName} onChange={e => setRegFormData({ ...regFormData, externalGuardianName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Guardian Contact Number</Label>
                  <Input placeholder="Contact Number" value={regFormData.externalGuardianNumber} onChange={e => setRegFormData({ ...regFormData, externalGuardianNumber: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assign Room <span className="text-destructive">*</span></Label>
                <Select value={regFormData.roomId} onValueChange={value => setRegFormData({ ...regFormData, roomId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => {
                      const isFull = room.currentOccupancy >= room.capacity;
                      const isCurrentRoom = registrationType === "internal"
                        ? room.allocations?.some(a => String(a.studentId) === String(regFormData.studentId)) || String(room.id) === String(regFormData.roomId)
                        : room.allocations?.some(a => a.externalName === regFormData.externalName) || String(room.id) === String(regFormData.roomId);
                      const isDisabled = isFull && !isCurrentRoom;
                      return (
                        <SelectItem key={room.id} value={String(room.id)} disabled={isDisabled}>
                          Room {room.roomNumber} ({room.roomType}) - {isCurrentRoom ? "Current Room" : isFull ? "Full" : `${room.capacity - room.currentOccupancy} Available`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Registration Date</Label>
                <Input type="date" value={regFormData.registrationDate} onChange={e => setRegFormData({ ...regFormData, registrationDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Decided Fee / Month (PKR) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={regFormData.decidedFeePerMonth}
                  onChange={e => setRegFormData({ ...regFormData, decidedFeePerMonth: e.target.value })}
                />
              </div>
            </div>

            {registrationType === "external" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Guardian CNIC <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. 12345-1234567-1"
                      value={regFormData.guardianCnic}
                      onChange={e => setRegFormData({ ...regFormData, guardianCnic: e.target.value })}
                      maxLength={15}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Student CNIC <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      placeholder="e.g. 12345-1234567-1"
                      value={regFormData.studentCnic}
                      onChange={e => setRegFormData({ ...regFormData, studentCnic: e.target.value })}
                      maxLength={15}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    placeholder="Home address"
                    value={regFormData.address}
                    onChange={e => setRegFormData({ ...regFormData, address: e.target.value })}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <Button
            onClick={handleAddRegistration}
            disabled={
              isSubmitting ||
              !regFormData.roomId ||
              (registrationType === "internal" ? !regFormData.studentId : !regFormData.externalName?.trim())
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode.reg ? "Saving..." : "Adding..."}
              </>
            ) : (
              editMode.reg ? "Save Changes" : "Add Registration"
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Student Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {profileReg?.studentId ? "Internal Student" : "External Student"} — {profileReg?.student ? `${profileReg.student.fName} ${profileReg.student.lName || ''}`.trim() : profileReg?.externalName}
            </DialogTitle>
          </DialogHeader>
          {profileReg && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="challans" className="flex-1">Fee Challans</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-3 space-y-3">
                {profileReg.studentId ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground font-medium">Full Name</span>
                      <span>{profileReg.student ? `${profileReg.student.fName} ${profileReg.student.lName || ''}`.trim() : "—"}</span>
                      <span className="text-muted-foreground font-medium">Roll Number</span>
                      <span>{profileReg.student?.rollNumber || "—"}</span>
                      <span className="text-muted-foreground font-medium">Program</span>
                      <span>{profileReg.student?.program?.name || "—"}</span>
                      <span className="text-muted-foreground font-medium">Registration Date</span>
                      <span>{profileReg.registrationDate ? new Date(profileReg.registrationDate).toLocaleDateString() : "—"}</span>
                      <span className="text-muted-foreground font-medium">Status</span>
                      <span><Badge variant={profileReg.status === "active" ? "default" : profileReg.status === "terminated" ? "destructive" : "secondary"}>{profileReg.status}</Badge></span>
                      <span className="text-muted-foreground font-medium">Decided Fee / Month</span>
                      <span>PKR {profileReg.decidedFeePerMonth != null ? Number(profileReg.decidedFeePerMonth).toLocaleString() : "—"}</span>
                      {profileReg.terminationReason && getLastTerminationReason(profileReg.terminationReason) && (
                        <>
                          <span className="text-muted-foreground font-medium">Termination Reason</span>
                          <span className="text-red-600 text-xs">{getLastTerminationReason(profileReg.terminationReason)}</span>
                        </>
                      )}
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Full student details are in the Students module.</p>
                      <Button className="w-full gap-2" onClick={() => { setProfileOpen(false); navigate("/students", { state: { openStudentId: profileReg.studentId } }); }}>
                        <ExternalLink className="h-4 w-4" /> View Full Profile in Students
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground font-medium">Full Name</span>
                    <span>{profileReg.externalName || "—"}</span>
                    <span className="text-muted-foreground font-medium">Institute</span>
                    <span>{profileReg.externalInstitute || "—"}</span>
                    <span className="text-muted-foreground font-medium">Guardian Name</span>
                    <span>{profileReg.externalGuardianName || "—"}</span>
                    <span className="text-muted-foreground font-medium">Guardian Phone</span>
                    <span>{profileReg.externalGuardianNumber || "—"}</span>
                    <span className="text-muted-foreground font-medium">Guardian CNIC</span>
                    <span>{profileReg.guardianCnic || "—"}</span>
                    <span className="text-muted-foreground font-medium">Student CNIC</span>
                    <span>{profileReg.studentCnic || "—"}</span>
                    <span className="text-muted-foreground font-medium">Address</span>
                    <span>{profileReg.address || "—"}</span>
                    <span className="text-muted-foreground font-medium">Registration Date</span>
                    <span>{profileReg.registrationDate ? new Date(profileReg.registrationDate).toLocaleDateString() : "—"}</span>
                    <span className="text-muted-foreground font-medium">Status</span>
                    <span><Badge variant={profileReg.status === "active" ? "default" : profileReg.status === "terminated" ? "destructive" : "secondary"}>{profileReg.status}</Badge></span>
                    <span className="text-muted-foreground font-medium">Decided Fee / Month</span>
                    <span>PKR {profileReg.decidedFeePerMonth != null ? Number(profileReg.decidedFeePerMonth).toLocaleString() : "—"}</span>
                    <span className="text-muted-foreground font-medium">Registration ID</span>
                    <span className="font-mono text-xs">{profileReg.id}</span>
                    {profileReg.terminationReason && getLastTerminationReason(profileReg.terminationReason) && (
                      <>
                        <span className="text-muted-foreground font-medium">Termination Reason</span>
                        <span className="text-red-600 text-xs">{getLastTerminationReason(profileReg.terminationReason)}</span>
                      </>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="challans" className="mt-3">
                {(profileChallans || []).filter(c => c && c.status !== 'VOID').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No challans yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {(profileChallans || []).filter(c => c && c.status !== 'VOID').map(c => {
                      const total = (c.hostelFee||0) + (c.fineAmount||0) + (c.lateFeeFine||0) + (c.arrearsAmount||0) - (c.discount||0);
                      const balance = Math.max(0, total - (c.paidAmount||0));
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-2">
                          <div>
                            <div className="font-medium">{c.month}</div>
                            <div className="text-muted-foreground">{c.challanNumber}</div>
                          </div>
                          <div className="text-right">
                            <div>PKR {total.toLocaleString()}</div>
                            {balance > 0 && <div className="text-red-600">Due: PKR {balance.toLocaleString()}</div>}
                            <span className={`font-semibold px-1.5 py-0.5 rounded leading-none ${
                              c.status === 'PAID' ? 'bg-green-100 text-green-700' :
                              c.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{c.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <RegistrationHistoryTab regId={profileReg.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the registration and deallocate the student from the room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={executeDelete}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Registration Dialog */}
      <Dialog open={terminateOpen} onOpenChange={open => { setTerminateOpen(open); if (!open) { setTerminateReg(null); setTerminateReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <UserX className="h-5 w-5" /> Terminate Registration
            </DialogTitle>
          </DialogHeader>
          {terminateReg && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are terminating the boarding registration for <span className="font-semibold text-foreground">
                  {terminateReg.student ? `${terminateReg.student.fName} ${terminateReg.student.lName || ''}`.trim() : terminateReg.externalName}
                </span>. This marks them as expelled. Please state the reason.
              </p>
              <div className="space-y-1.5">
                <Label>Reason for Termination <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="e.g. Violation of boarding rules, disciplinary action..."
                  value={terminateReason}
                  onChange={e => setTerminateReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={isTerminating} onClick={() => setTerminateOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={isTerminating || !terminateReason.trim()}
                  onClick={async () => {
                    setIsTerminating(true);
                    try {
                      await terminateHostelRegistration(terminateReg.id, terminateReason);
                      queryClient.invalidateQueries({ queryKey: ['hostelRegistrations'] });
                      queryClient.invalidateQueries({ queryKey: ['rooms'] });
                      toast({ title: "Registration terminated" });
                      setTerminateOpen(false);
                    } catch (e) {
                      toast({ title: e.message || "Failed to terminate", variant: "destructive" });
                    } finally {
                      setIsTerminating(false);
                    }
                  }}
                >
                  {isTerminating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Terminating...</> : "Terminate"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Registration Dialog */}
      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" /> Withdraw Registration
            </AlertDialogTitle>
            <AlertDialogDescription>
              This marks <span className="font-semibold">
                {withdrawReg?.student ? `${withdrawReg.student.fName} ${withdrawReg.student.lName || ''}`.trim() : withdrawReg?.externalName}
              </span> as withdrawn (checked out voluntarily).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setWithdrawOpen(false); setWithdrawReg(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isWithdrawing} onClick={async () => {
              setIsWithdrawing(true);
              try {
                await withdrawHostelRegistration(withdrawReg.id);
                queryClient.invalidateQueries({ queryKey: ['hostelRegistrations'] });
                queryClient.invalidateQueries({ queryKey: ['rooms'] });
                toast({ title: "Registration withdrawn" });
                setWithdrawOpen(false);
                setWithdrawReg(null);
              } catch (e) {
                toast({ title: e.message || "Failed to withdraw", variant: "destructive" });
              } finally {
                setIsWithdrawing(false);
              }
            }}>
              {isWithdrawing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Withdrawing...</> : "Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Readmit Registration Dialog */}
      <AlertDialog open={readmitOpen} onOpenChange={open => { setReadmitOpen(open); if (!open) setReadmitReg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-green-600" /> Readmit Registration
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                You are readmitting <span className="font-semibold text-foreground">
                  {readmitReg?.student ? `${readmitReg.student.fName} ${readmitReg.student.lName || ''}`.trim() : readmitReg?.externalName}
                </span> back to boarding.
              </span>
              {readmitReg?.status === 'terminated' && readmitReg?.terminationReason && getLastTerminationReason(readmitReg.terminationReason) && (
                <span className="block text-xs text-red-600 mt-1">
                  Previously terminated for: "{getLastTerminationReason(readmitReg.terminationReason)}"
                </span>
              )}
              <span className="block text-xs text-muted-foreground mt-1">
                Their previous room allocation will be restored and status set back to active.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setReadmitOpen(false); setReadmitReg(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-green-600 hover:bg-green-700" disabled={isReadmitting} onClick={async () => {
              setIsReadmitting(true);
              try {
                await readmitHostelRegistration(readmitReg.id);
                queryClient.invalidateQueries({ queryKey: ['hostelRegistrations'] });
                queryClient.invalidateQueries({ queryKey: ['rooms'] });
                queryClient.invalidateQueries({ queryKey: ['hostelRegHistory', readmitReg.id] });
                toast({ title: "Registration readmitted successfully" });
                setReadmitOpen(false);
                setReadmitReg(null);
              } catch (e) {
                toast({ title: e.message || "Failed to readmit", variant: "destructive" });
              } finally {
                setIsReadmitting(false);
              }
            }}>
              {isReadmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Readmitting...</> : "Readmit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
