import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { GraduationCap, PlusCircle, Edit, Trash2, UserCheck, CheckCircle2, XCircle, Clock, CalendarIcon, Eye, IdCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeachers,
  createTeacher as createTeacherAPI,
  updateTeacher as updateTeacherAPI,
  deleteTeacher as deleteTeacherAPI,
  getTeacherAttendance,
  markTeacherAttendance,
  getDepartments,
  getAttendanceSummary,
  getPayrollSheet,
  getDefaultStaffIDCardTemplate,
} from "../../config/apis";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateDuration } from "../lib/dateUtils";
import {
  IMAGE_UPLOAD_RULES,
  INPUT_LIMITS,
  firstError,
  formatCnic,
  validateCnic,
  validateEmail,
  validateImageFile,
  validateMaxLength,
  validateNonNegativeNumber,
  validatePkPhone,
  validateRequired,
} from "@/lib/inputValidation";

const TEACHER_DOCUMENTS = [
  { key: "bsDegree", label: "BS/BSc Degree" },
  { key: "msDegree", label: "MS/MSc Degree" },
  { key: "phd", label: "PhD" },
  { key: "postDoc", label: "Postdoc" },
  { key: "experienceLetter", label: "Experience Letter" },
  { key: "cv", label: "CV" },
];

const Teachers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [activeScreen, setActiveScreen] = useState("management");

  // Detail Dialog States
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewTeacher, setViewTeacher] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  // ID Card State
  const [idCardDialog, setIdCardDialog] = useState(false);
  const [selectedTeacherForCard, setSelectedTeacherForCard] = useState(null);
  const [idCardTemplate, setIdCardTemplate] = useState("");

  const handleIDCardPreview = async (teacher) => {
    try {
      setSelectedTeacherForCard(teacher);
      const template = await getDefaultStaffIDCardTemplate();
      if (template) {
        setIdCardTemplate(template.htmlContent);
        setIdCardDialog(true);
      } else {
        toast({
          title: "No Default Template",
          description: "Please set a default Staff ID Card template in Configuration.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error fetching template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    fatherName: "",
    cnic: "",
    address: "",
    email: "",
    password: "",
    phone: "",
    specialization: "",
    highestDegree: "",
    staffType: "CONTRACT",
    status: "ACTIVE",
    departmentId: "",
    basicPay: "",
    documents: TEACHER_DOCUMENTS.reduce((acc, doc) => ({ ...acc, [doc.key]: false }), {}),
    photo: null,
    contractStart: "",
    contractEnd: "",
    joinDate: "",
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch Teachers
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: getTeachers,
  });

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  // Attendance
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: teacherAttendance = [], isFetching: attendanceLoading } = useQuery({
    queryKey: ["teacherAttendance", selectedDate],
    queryFn: () => getTeacherAttendance(selectedDate),
    enabled: !!selectedDate,
  });

  const [attendanceData, setAttendanceData] = useState({});

  // Teacher Detail Data Queries
  const { data: teacherAttendanceSummary = [], isLoading: attendanceSummaryLoading } = useQuery({
    queryKey: ["teacherAttendanceSummary", viewTeacher?.id, selectedMonth],
    queryFn: () => getAttendanceSummary(selectedMonth, viewTeacher.id, "TEACHER"),
    enabled: !!viewTeacher?.id && detailDialogOpen,
  });

  const { data: teacherPayrollHistory = [], isLoading: payrollHistoryLoading } = useQuery({
    queryKey: ["teacherPayrollHistory", selectedMonth],
    queryFn: () => getPayrollSheet(selectedMonth, "teacher"),
    enabled: !!viewTeacher?.id && detailDialogOpen,
  });
  console.log(teacherPayrollHistory)

  // Mutations
  const createTeacherMutation = useMutation({
    mutationFn: createTeacherAPI,
    onSuccess: () => {
      queryClient.invalidateQueries(["teachers"]);
      toast({ title: "Teacher added successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast({ title: err.message })
  });

  const updateTeacherMutation = useMutation({
    mutationFn: ({ id, data }) => updateTeacherAPI(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["teachers"]);
      toast({ title: "Teacher updated successfully" });
      setOpen(false);
      resetForm();
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: deleteTeacherAPI,
    onSuccess: () => {
      queryClient.invalidateQueries(["teachers"]);
      toast({ title: "Teacher deleted successfully", variant: "destructive" });
      setDeleteDialogOpen(false);
      setTeacherToDelete(null);
    },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: ({ id, status, date }) => markTeacherAttendance(id, status, date),
    onSuccess: () => {
      // toast({ title: "Attendance marked" });
      queryClient.invalidateQueries(["teacherAttendance"]);
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  // Handlers
  const handleMarkAttendance = (id, status) => {
    markAttendanceMutation.mutate({
      id,
      status,
      date: format(selectedDate, "yyyy-MM-dd"),
    });
  };

  const markAllPresent = () => {
    teachers.forEach((t) => {
      if (!teacherAttendance.find(a => a.teacherId === t.id)) {
        handleMarkAttendance(t.id, "PRESENT");
      }
    });
  };

  const toggleDocument = (key) => {
    setFormData((prev) => ({
      ...prev,
      documents: { ...prev.documents, [key]: !prev.documents[key] },
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      fatherName: "",
      cnic: "",
      address: "",
      email: "",
      password: "",
      phone: "",
      specialization: "",
      highestDegree: "",
      staffType: "CONTRACT",
      status: "ACTIVE",
      departmentId: "",
      basicPay: "",
      documents: TEACHER_DOCUMENTS.reduce((acc, doc) => ({ ...acc, [doc.key]: false }), {}),
      contractStart: "",
      contractEnd: "",
      joinDate: "",
    });
    setEditingTeacher(null);
    setFormErrors({});
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name || "",
      fatherName: teacher.fatherName || "",
      cnic: teacher.cnic || "",
      address: teacher.address || "",
      email: teacher.email || "",
      password: "",
      phone: teacher.phone || "",
      specialization: teacher.specialization || "",
      highestDegree: teacher.highestDegree || "",
      staffType: teacher.staffType || "CONTRACT",
      status: teacher.status || "ACTIVE",
      departmentId: teacher.departmentId?.toString() || "",
      basicPay: teacher.basicPay?.toString() || "",
      documents: teacher.documents || TEACHER_DOCUMENTS.reduce((acc, doc) => ({ ...acc, [doc.key]: false }), {}),
      photo: null,
      contractStart: teacher.contractStart ? format(new Date(teacher.contractStart), "yyyy-MM-dd") : "",
      contractEnd: teacher.contractEnd ? format(new Date(teacher.contractEnd), "yyyy-MM-dd") : "",
      joinDate: teacher.joinDate ? format(new Date(teacher.joinDate), "yyyy-MM-dd") : "",
    });
    setFormErrors({});
    setOpen(true);
  };

  const handleSubmit = () => {
    const nextErrors = {
      name: firstError(validateRequired(formData.name, "Name"), validateMaxLength(formData.name, INPUT_LIMITS.name, "Name")),
      fatherName: firstError(validateRequired(formData.fatherName, "Father name"), validateMaxLength(formData.fatherName, INPUT_LIMITS.name, "Father name")),
      cnic: validateCnic(formData.cnic),
      address: validateMaxLength(formData.address, INPUT_LIMITS.longText, "Address"),
      email: firstError(validateRequired(formData.email, "Email"), validateEmail(formData.email)),
      phone: validatePkPhone(formData.phone),
      password: !editingTeacher ? firstError(validateRequired(formData.password, "Password"), validateMaxLength(formData.password, INPUT_LIMITS.password, "Password")) : validateMaxLength(formData.password, INPUT_LIMITS.password, "Password"),
      specialization: validateMaxLength(formData.specialization, INPUT_LIMITS.name, "Specialization"),
      highestDegree: firstError(validateRequired(formData.highestDegree, "Highest degree"), validateMaxLength(formData.highestDegree, INPUT_LIMITS.name, "Highest degree")),
      basicPay: validateNonNegativeNumber(formData.basicPay, "Basic pay"),
      photo: validateImageFile(formData.photo),
    };
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setFormErrors({});

    const payload = new FormData();
    payload.append("name", formData.name);
    payload.append("fatherName", formData.fatherName);
    payload.append("cnic", formData.cnic || "");
    payload.append("address", formData.address || "");
    payload.append("email", formData.email);
    payload.append("phone", formData.phone || "");
    payload.append("specialization", formData.specialization);
    payload.append("highestDegree", formData.highestDegree);
    payload.append("staffType", formData.staffType);
    payload.append("status", formData.status);
    payload.append("departmentId", formData.departmentId ? formData.departmentId : "");
    payload.append("basicPay", formData.basicPay || "");
    payload.append("documents", JSON.stringify(formData.documents));
    payload.append("contractStart", formData.contractStart || "");
    payload.append("contractEnd", formData.contractEnd || "");
    payload.append("joinDate", formData.joinDate || "");

    if (formData.password) payload.append("password", formData.password);
    if (formData.photo) payload.append("photo", formData.photo);

    if (editingTeacher) {
      updateTeacherMutation.mutate({ id: editingTeacher.id, data: payload });
    } else {
      createTeacherMutation.mutate(payload);
    }
  };

  const handleDelete = (id) => {
    setTeacherToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (teacherToDelete) deleteTeacherMutation.mutate(teacherToDelete);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className=" rounded-md p-6 text-primary-foreground shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">
              {activeScreen === "management" ? "Teacher Management" : "Teacher Attendance"}
            </h2>
            <p className="text-primary-foreground/90 text-sm sm:text-base">
              {activeScreen === "management"
                ? "Manage teachers, departments, and documents"
                : "Mark and track teacher attendance"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            <Button
              variant={activeScreen === "management" ? "default" : "ghost"}
              onClick={() => setActiveScreen("management")}
            >
              <GraduationCap className="w-4 h-4 mr-1" /> Management
            </Button>
            <Button
              variant={activeScreen === "attendance" ? "default" : "ghost"}
              onClick={() => setActiveScreen("attendance")}
            >
              <UserCheck className="w-4 h-4 mr-1" /> Attendance
            </Button>
          </div>
        </div>

        {/* Content */}
        {activeScreen === "management" ? (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Teachers
              </CardTitle>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-6xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTeacher ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Name */}
                    <div>
                      <Label>Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={formErrors.name ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.name} />
                    </div>

                    {/* Photo */}
                    <div>
                      <Label>Photo (PNG, JPG, JPEG. Max 10MB)</Label>
                      <Input
                        type="file"
                        accept={IMAGE_UPLOAD_RULES.accept}
                        className={formErrors.photo ? "border-destructive" : ""}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const error = validateImageFile(file);
                            if (error) {
                              setFormErrors(prev => ({ ...prev, photo: error }));
                              e.target.value = "";
                              return;
                            }
                            setFormErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
                            setFormData({ ...formData, photo: file });
                          }
                        }}
                      />
                      <FieldError message={formErrors.photo} />
                    </div>

                    {/* Father Name */}
                    <div>
                      <Label>Father Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        className={formErrors.fatherName ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.fatherName} />
                    </div>

                    {/* CNIC */}
                    <div>
                      <Label>CNIC</Label>
                      <Input
                        value={formData.cnic}
                        onChange={(e) => setFormData({ ...formData, cnic: formatCnic(e.target.value) })}
                        placeholder="12345-1234567-1"
                        className={formErrors.cnic ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.cnic} />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <Label>Address</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className={formErrors.address ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.address} />
                    </div>

                    {/* Email */}
                    <div>
                      <Label>Email <span className="text-red-500">*</span></Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={formErrors.email ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.email} />
                    </div>


                    {/* Phone */}
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={formErrors.phone ? "border-destructive" : ""}
                        placeholder="0300-1234567"
                      />
                      <FieldError message={formErrors.phone} />
                    </div>
                    {/* Password */}
                    <div>
                      <Label>Password {editingTeacher ? "(Leave blank to keep same)" : <span className="text-red-500">*</span>}</Label>
                      <PasswordInput
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={formErrors.password ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.password} />
                    </div>

                    {/* Specialization */}
                    <div>
                      <Label>Specialization</Label>
                      <Input
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        className={formErrors.specialization ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.specialization} />
                    </div>

                    {/* Highest Degree */}
                    <div>
                      <Label>Highest Degree</Label>
                      <Select
                        value={formData.highestDegree}
                        onValueChange={(v) => setFormData({ ...formData, highestDegree: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select degree" />
                        </SelectTrigger>
                        <SelectContent>
                          {["FA/FSc", "BA/BSc/BS", "MA/MSc/MS", "PhD", "Postdoc", "Other"].map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={formErrors.highestDegree} />
                    </div>

                    <div>
                      <Label>Employment Type</Label>
                      <Select
                        value={formData.staffType}
                        onValueChange={(v) => setFormData({ ...formData, staffType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERMANENT">Permanent</SelectItem>
                          <SelectItem value="CONTRACT">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="TERMINATED">Terminated</SelectItem>
                          <SelectItem value="RETIRED">Retired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Department */}
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(v) => setFormData({ ...formData, departmentId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="*">None</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Basic Pay */}
                    <div>
                      <Label>Basic Pay (PKR)</Label>
                      <Input
                        type="number"
                        value={formData.basicPay}
                        onChange={(e) => setFormData({ ...formData, basicPay: e.target.value })}
                        placeholder="0"
                        className={formErrors.basicPay ? "border-destructive" : ""}
                      />
                      <FieldError message={formErrors.basicPay} />
                    </div>

                    {/* Join Date */}
                    <div>
                      <Label>Join Date</Label>
                      <Input
                        type="date"
                        value={formData.joinDate}
                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                      />
                    </div>

                    {/* Contract Dates - Only for CONTRACT staff */}
                    {formData.staffType === "CONTRACT" && (
                      <>
                        <div>
                          <Label>Contract Start Date</Label>
                          <Input
                            type="date"
                            value={formData.contractStart}
                            onChange={(e) => setFormData({ ...formData, contractStart: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Contract End Date</Label>
                          <Input
                            type="date"
                            value={formData.contractEnd}
                            onChange={(e) => setFormData({ ...formData, contractEnd: e.target.value })}
                          />
                        </div>
                      </>
                    )}


                  </div>

                  {/* Documents */}
                  <div className="mt-6">
                    <Label>Documents</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                      {TEACHER_DOCUMENTS.map((doc) => (
                        <div
                          key={doc.key}
                          onClick={() => toggleDocument(doc.key)}
                          className={`cursor-pointer rounded-lg border p-3 text-center text-sm transition-all ${formData.documents[doc.key]
                            ? "bg-primary text-white border-primary"
                            : "border-gray-300 hover:bg-gray-100"
                            }`}
                        >
                          {doc.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={createTeacherMutation.isPending || updateTeacherMutation.isPending}>
                      {(createTeacherMutation.isPending || updateTeacherMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingTeacher ? "Update" : "Add"} Teacher
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>

            {/* Table */}
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Degree</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Basic Pay</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar>
                              <AvatarImage className="object-cover" src={t.photo_url} alt={t.name} />
                              <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {t.name}
                          </div>
                        </TableCell>
                        <TableCell>{t.email}</TableCell>
                        <TableCell>{t.phone || "-"}</TableCell>
                        <TableCell>{t.specialization || "-"}</TableCell>
                        <TableCell>{t.highestDegree || "-"}</TableCell>
                        <TableCell>{t.department?.name || "-"}</TableCell>
                        <TableCell>{t.basicPay ? `PKR ${parseFloat(t.basicPay).toLocaleString()}` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={t.staffType === "PERMANENT" ? "default" : "secondary"}>
                            {t.staffType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.status === "ACTIVE"
                                ? "default"
                                : t.status === "TERMINATED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setViewTeacher(t); setDetailDialogOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleIDCardPreview(t)}>
                              <IdCard className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(t)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Attendance Section
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Attendance
                </CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {format(selectedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => {
                        setSelectedDate(d);
                        queryClient.invalidateQueries(["teacherAttendance"]);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={markAllPresent}>Mark All Present</Button>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <p className="text-center py-4">Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher) => {
                      const record = teacherAttendance.find(a => a.teacherId === teacher.id);
                      return (
                        <TableRow key={teacher.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage className="object-cover" src={teacher.photo_url} alt={teacher.name} />
                                <AvatarFallback>{teacher.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              {teacher.name}
                            </div>
                          </TableCell>
                          <TableCell>{format(selectedDate, "PPP")}</TableCell>
                          <TableCell>
                            {record ? (
                              <Badge
                                variant={
                                  record.status === "PRESENT" ? "default" :
                                    record.status === "ABSENT" ? "destructive" : "secondary"
                                }
                              >
                                {record.status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Not Marked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={record?.status === "PRESENT" ? "default" : "outline"}
                                onClick={() => handleMarkAttendance(teacher.id, "PRESENT")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={record?.status === "ABSENT" ? "destructive" : "outline"}
                                onClick={() => handleMarkAttendance(teacher.id, "ABSENT")}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={record?.status === "LEAVE" ? "secondary" : "outline"}
                                onClick={() => handleMarkAttendance(teacher.id, "LEAVE")}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
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
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Teacher?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleteTeacherMutation.isPending}>
                {deleteTeacherMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View / Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto flex flex-col">
            <DialogHeader>
              <DialogTitle>Teacher Profile</DialogTitle>
            </DialogHeader>
            {viewTeacher && (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="payroll">Payroll History</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-6 pt-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-24 w-24 border-4 border-background">
                      <AvatarImage className="object-cover" src={viewTeacher.photo_url} alt={viewTeacher.name} />
                      <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary uppercase">
                        {viewTeacher.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-x-hidden">
                      <h3 className="text-2xl font-bold">{viewTeacher.name}</h3>
                      <p className="text-muted-foreground">{viewTeacher.fatherName ? `s/o ${viewTeacher.fatherName}` : ""}</p>
                      <p className="text-muted-foreground">{viewTeacher.email}</p>
                      <p className="text-muted-foreground break-words w-1/2">{viewTeacher.address}</p>
                      <p className="text-muted-foreground">CNIC: {viewTeacher.cnic}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge>{viewTeacher.staffType}</Badge>
                        <Badge variant={viewTeacher.status === "ACTIVE" ? "default" : "destructive"}>
                          {viewTeacher.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-muted-foreground">Contact</h4>
                      <p>{viewTeacher.phone || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-muted-foreground">Department</h4>
                      <p>{viewTeacher.department?.name || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-muted-foreground">Qualification</h4>
                      <p>{viewTeacher.highestDegree} - {viewTeacher.specialization}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-muted-foreground">Basic Pay</h4>
                      <p>PKR {viewTeacher.basicPay ? parseFloat(viewTeacher.basicPay).toLocaleString() : "0"}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-muted-foreground">Join Date</h4>
                      <p>{viewTeacher.joinDate ? format(new Date(viewTeacher.joinDate), "PPP") : "N/A"}</p>
                    </div>

                    {viewTeacher.staffType === "CONTRACT" ? (
                      <>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm text-muted-foreground">Contract Start</h4>
                          <p>{viewTeacher.contractStart ? format(new Date(viewTeacher.contractStart), "PPP") : "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm text-muted-foreground">Contract End</h4>
                          <p>{viewTeacher.contractEnd ? format(new Date(viewTeacher.contractEnd), "PPP") : "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm text-muted-foreground">Contract Duration</h4>
                          <p className="font-bold text-primary">
                            {calculateDuration(viewTeacher.contractStart, viewTeacher.contractEnd)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm text-muted-foreground">Tenure (Total Service)</h4>
                        <p className="font-bold text-primary">
                          {calculateDuration(viewTeacher.joinDate)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground">Documents Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {TEACHER_DOCUMENTS.map((doc) => {
                        const isPresent = viewTeacher.documents?.[doc.key];
                        return (
                          <div key={doc.key} className={`flex items-center gap-2 p-2 rounded border ${isPresent ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                            {isPresent ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span className="text-sm font-medium">{doc.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="payroll" className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Monthly Payroll</h3>
                    <Input
                      type="month"
                      className="w-auto"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                  </div>

                  {payrollHistoryLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Basic Pay</TableHead>
                            <TableHead>Allowances</TableHead>
                            <TableHead>Deductions</TableHead>
                            <TableHead>Net Salary</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Filter payroll for this teacher from the monthly sheet */}
                          {teacherPayrollHistory
                            .filter(p => p.id === viewTeacher.id)
                            .map(p => (
                              <TableRow key={p.id}>
                                <TableCell>{format(new Date(selectedMonth), "MMMM yyyy")}</TableCell>
                                <TableCell>{p.basicSalary.toLocaleString()}</TableCell>
                                <TableCell className="text-green-600">+{p.totalAllowances.toLocaleString()}</TableCell>
                                <TableCell className="text-red-600">-{p.totalDeductions.toLocaleString()}</TableCell>
                                <TableCell className="font-bold">{p.netSalary.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant={p.status === "PAID" ? "default" : "outline"}>{p.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          {teacherPayrollHistory.filter(p => p.id === viewTeacher.id).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                No payroll record found for selected month
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attendance" className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Attendance Summary</h3>
                    <Input
                      type="month"
                      className="w-auto"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                  </div>

                  {attendanceSummaryLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-4 gap-4">
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-green-700">{teacherAttendanceSummary?.present || 0}</div>
                            <div className="text-sm text-green-600">Present</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-red-50 border-red-100">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-red-700">{teacherAttendanceSummary?.absent || 0}</div>
                            <div className="text-sm text-red-600">Absent</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-orange-50 border-orange-100">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-orange-700">{teacherAttendanceSummary?.leaves || 0}</div>
                            <div className="text-sm text-orange-600">Leaves</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-blue-700">{teacherAttendanceSummary?.late || 0}</div>
                            <div className="text-sm text-blue-600">Late</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Maybe a day-wise list if available later */}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ID Card Preview Dialog */}
      <Dialog open={idCardDialog} onOpenChange={setIdCardDialog}>
        <DialogContent className="max-w-fit max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher ID Card Preview</DialogTitle>
          </DialogHeader>
          <div className="">
            {selectedTeacherForCard && idCardTemplate && (
              <div
                className="id-card-print-area text-black"
                dangerouslySetInnerHTML={{
                  __html: idCardTemplate
                    .replace(/{{name}}/g, selectedTeacherForCard.name)
                    .replace(/{{employeePhoto}}/g, selectedTeacherForCard.photo_url || "")
                    .replace(/{{fatherName}}/g, selectedTeacherForCard.fatherName || "")
                    .replace(/{{designation}}/g, selectedTeacherForCard.specialization || "TEACHER")
                    .replace(/{{EmpOrTeacher}}/g, "TEACHER")
                    .replace(/{{employeeId}}/gi, String(selectedTeacherForCard.staffId || selectedTeacherForCard.employeeId || selectedTeacherForCard.id || ""))
                    .replace(/{{staffId}}/gi, String(selectedTeacherForCard.staffId || selectedTeacherForCard.employeeId || selectedTeacherForCard.id || ""))
                    .replace(/{{empId}}/gi, String(selectedTeacherForCard.staffId || selectedTeacherForCard.employeeId || selectedTeacherForCard.id || ""))
                    .replace(/{{employee_id}}/gi, String(selectedTeacherForCard.staffId || selectedTeacherForCard.employeeId || selectedTeacherForCard.id || ""))
                    .replace(/{{phone}}/g, selectedTeacherForCard.phone || "")
                    .replace(/{{email}}/g, selectedTeacherForCard.email || "")
                    .replace(/{{department}}/g, selectedTeacherForCard.department?.name || "")
                    .replace(/{{issueDate}}/g, new Date().toLocaleDateString())
                    .replace(/{{dob}}/gi, selectedTeacherForCard.dob ? new Date(selectedTeacherForCard.dob).toLocaleDateString() : "")
                    .replace(/{{cnic}}/g, selectedTeacherForCard.cnic || "")
                    .replace(/{{bloodGroup}}/gi, selectedTeacherForCard.bloodGroup || "")
                    .replace(/{{address}}/g, selectedTeacherForCard.address || "")
                }}
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIdCardDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                const printContent = document.querySelector('.id-card-print-area').innerHTML;
                const printWindow = window.open('', '', 'height=800,width=800');

                printWindow.document.write('<html><head><title>Print ID Card</title>');
                // Copy styles/scripts if necessary or use specific print styles. 
                // For safety, let's copy styles from the current document.
                Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach(style => {
                  printWindow.document.head.appendChild(style.cloneNode(true));
                });
                printWindow.document.write(`
                  <style>
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  </style>
                `);
                printWindow.document.write('</head><body>');
                printWindow.document.write(printContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                // Wait for images to load (heuristic)
                setTimeout(() => {
                  printWindow.print();
                  // Close optionally or keep open based on user preference "open the design in new tab" 
                  // We'll keep it open as requested "open the design in new tab" imply viewing it.
                  // printWindow.close(); 
                }, 1000);
              }}>Print ID Card</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Teachers;
