import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getReportCardTemplates,
  createReportCardTemplate,
  updateReportCardTemplate,
  deleteReportCardTemplate,
  getPayrollTemplates,
  createPayrollTemplate,
  updatePayrollTemplate,
  deletePayrollTemplate,
  getStaffIDCardTemplates,
  createStaffIDCardTemplate,
  updateStaffIDCardTemplate,
  deleteStaffIDCardTemplate,
  getStudentIDCardTemplates,
  createStudentIDCardTemplate,
  updateStudentIDCardTemplate,
  deleteStudentIDCardTemplate,
  getFeeChallanTemplates,
  createFeeChallanTemplate,
  updateFeeChallanTemplate,
  deleteFeeChallanTemplate,
} from "@/services/api";
import {
  salarySlipTemplate,
  payrollSheetTemplate,
  reportCardDesignTemplate,
  challanDesignTemplate,
  teacherIdCardDesignTemplate,
  studentIdCardDesignTemplate,
} from "./templateConstants";
import usePermissions from "@/hooks/usePermissions";

export const TemplatesTab = () => {
  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions("Configuration", "templates");

  const [challanDialog, setChallanDialog] = useState(false);
  const [marksheetDialog, setMarksheetDialog] = useState(false);
  const [teacherIdCardDialog, setTeacherIdCardDialog] = useState(false);
  const [studentIdCardDialog, setStudentIdCardDialog] = useState(false);
  const [payrollDialog, setPayrollDialog] = useState(false);

  const [savingTemplate, setSavingTemplate] = useState("");
  const [deletingTemplate, setDeletingTemplate] = useState({ type: "", id: null });

  const [challanForm, setChallanForm] = useState({
    name: "",
    htmlContent: "",
    type: "INSTALLMENT",
  });
  const [marksheetForm, setMarksheetForm] = useState({
    name: "",
    htmlContent: "",
  });
  const [teacherIdCardForm, setTeacherIdCardForm] = useState({
    name: "",
    htmlContent: "",
  });
  const [studentIdCardForm, setStudentIdCardForm] = useState({
    name: "",
    htmlContent: "",
  });
  const [payrollForm, setPayrollForm] = useState({
    name: "",
    type: "SALARY_SLIP",
    htmlContent: "",
  });

  const [editingChallan, setEditingChallan] = useState(null);
  const [editingMarksheet, setEditingMarksheet] = useState(null);
  const [editingTeacherIdCard, setEditingTeacherIdCard] = useState(null);
  const [editingStudentIdCard, setEditingStudentIdCard] = useState(null);
  const [editingPayroll, setEditingPayroll] = useState(null);

  const [previewChallan, setPreviewChallan] = useState(null);
  const [previewMarksheet, setPreviewMarksheet] = useState(null);
  const [previewTeacherIdCard, setPreviewTeacherIdCard] = useState(null);
  const [previewStudentIdCard, setPreviewStudentIdCard] = useState(null);
  const [previewPayroll, setPreviewPayroll] = useState(null);

  const [feeChallanTemplates, setFeeChallanTemplates] = useState([]);
  const [teacherIdCardTemplates, setTeacherIdCardTemplates] = useState([]);
  const [studentIdCardTemplates, setStudentIdCardTemplates] = useState([]);
  const [marksheetTemplates, setMarksheetTemplates] = useState([]);
  const [payrollTemplates, setPayrollTemplates] = useState([]);

  const CHALLAN_TYPES = [
    { value: "INSTALLMENT", label: "Standard Installment" },
    { value: "EXTRA", label: "Extra Fee Challan" },
    { value: "HOSTEL", label: "Hostel Challan" },
  ];

  const PAYROLL_TYPES = [
    { value: "SALARY_SLIP", label: "Salary Slip" },
    { value: "PAYROLL_SHEET", label: "Payroll Sheet" },
  ];

  const existingChallanTypes = feeChallanTemplates.map((t) => t.type);
  const availableChallanTypes = CHALLAN_TYPES.filter(
    (t) => !existingChallanTypes.includes(t.value)
  );
  const isAllChallanTypesConfigured = availableChallanTypes.length === 0;

  const hasTeacherIdCardTemplate = teacherIdCardTemplates.length > 0;
  const hasStudentIdCardTemplate = studentIdCardTemplates.length > 0;
  const hasMarksheetTemplate = marksheetTemplates.length > 0;

  const existingPayrollTypes = payrollTemplates.map((t) => t.type);
  const availablePayrollTypes = PAYROLL_TYPES.filter(
    (t) => !existingPayrollTypes.includes(t.value)
  );
  const isAllPayrollTypesConfigured = availablePayrollTypes.length === 0;

  const refreshFeeChallanTemplates = async () => {
    const templates = await getFeeChallanTemplates();
    setFeeChallanTemplates(Array.isArray(templates) ? templates : []);
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const [feeChallanRes, marksheetRes, payrollRes, staffIdCardRes, studentIdCardRes] =
          await Promise.allSettled([
            getFeeChallanTemplates(),
            getReportCardTemplates(),
            getPayrollTemplates(),
            getStaffIDCardTemplates(),
            getStudentIDCardTemplates(),
          ]);
        if (feeChallanRes.status === "fulfilled")
          setFeeChallanTemplates(Array.isArray(feeChallanRes.value) ? feeChallanRes.value : []);
        if (marksheetRes.status === "fulfilled")
          setMarksheetTemplates(Array.isArray(marksheetRes.value) ? marksheetRes.value : []);
        if (payrollRes.status === "fulfilled")
          setPayrollTemplates(Array.isArray(payrollRes.value) ? payrollRes.value : []);
        if (staffIdCardRes.status === "fulfilled")
          setTeacherIdCardTemplates(
            Array.isArray(staffIdCardRes.value) ? staffIdCardRes.value : []
          );
        if (studentIdCardRes.status === "fulfilled")
          setStudentIdCardTemplates(
            Array.isArray(studentIdCardRes.value) ? studentIdCardRes.value : []
          );
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast({
          title: "Error fetching templates",
          description: "Please try again later",
          variant: "destructive",
        });
      }
    };
    fetchTemplates();
  }, [toast]);

  const renderButtonContent = (loading, loadingText, defaultContent) =>
    loading ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {loadingText}
      </>
    ) : (
      defaultContent
    );

  const renderChallanPreview = (html, type) => {
    if (!html) return "";
    let rendered = html;

    const data = {
      challanNumber: "CH-2026-0001",
      studentName: "Sample Student Name",
      fatherName: "Sample Father Name",
      class: "Program / Class / Section",
      rollNo: "ROLL-001",
      month: "January 2026",
      installmentNo: "1",
      issueDate: new Date().toLocaleDateString(),
      dueDate: new Date(Date.now() + 864000000).toLocaleDateString(),
    };

    rendered = rendered.replace(/\{\{challanNumber\}\}/g, data.challanNumber);
    rendered = rendered.replace(/\{\{challanNo\}\}/g, data.challanNumber);
    rendered = rendered.replace(/\{\{studentName\}\}/g, data.studentName);
    rendered = rendered.replace(/\{\{fatherName\}\}/g, data.fatherName);
    rendered = rendered.replace(/\{\{class\}\}/g, data.class);
    rendered = rendered.replace(/\{\{rollNo\}\}/g, data.rollNo);
    rendered = rendered.replace(/\{\{issueDate\}\}/g, data.issueDate);
    rendered = rendered.replace(/\{\{dueDate\}\}/g, data.dueDate);
    rendered = rendered.replace(/\{\{session\}\}/g, "Session 2025-26");

    if (type === "EXTRA") {
      rendered = rendered.replace(/Month \/ Installment/g, "");
      rendered = rendered.replace(/\{\{month\}\}/g, "");
      rendered = rendered.replace(/\{\{installmentNo\}\}/g, "");
      rendered = rendered.replace(
        /\{\{feeHeadsRows\}\}/g,
        "<tr><td>Extra Activity Fee</td><td>0.00</td></tr>\n<tr><td>Library Fine</td><td>0.00</td></tr>"
      );
      rendered = rendered.replace(/\{\{totalPayable\}\}/g, "0.00");
      rendered = rendered.replace(/\{\{lateFee\}\}/g, "0.00");
    } else if (type === "HOSTEL") {
      rendered = rendered.replace(/\{\{month\}\}/g, data.month);
      rendered = rendered.replace(/\{\{installmentNo\}\}/g, "");
      rendered = rendered.replace(
        /\{\{feeHeadsRows\}\}/g,
        "<tr><td>Hostel Accommodation</td><td>0.00</td></tr>\n<tr><td>Mess Charges</td><td>0.00</td></tr>"
      );
      rendered = rendered.replace(/\{\{totalPayable\}\}/g, "0.00");
      rendered = rendered.replace(/\{\{lateFee\}\}/g, "0.00");
    } else {
      rendered = rendered.replace(/\{\{month\}\}/g, data.month);
      rendered = rendered.replace(/\{\{installmentNo\}\}/g, data.installmentNo);
      rendered = rendered.replace(/\{\{Tuition Fee\}\}/g, "0.00");
      rendered = rendered.replace(
        /\{\{feeHeadsRows\}\}/g,
        "<tr><td>Admission Fee</td><td>0.00</td></tr>"
      );
      rendered = rendered.replace(/\{\{totalPayable\}\}/g, "0.00");
      rendered = rendered.replace(/\{\{lateFee\}\}/g, "0.00");
    }

    rendered = rendered.replace(/\{\{arrears\}\}/g, "0.00");
    rendered = rendered.replace(/\{\{arrearsRows\}\}/g, "");
    rendered = rendered.replace(/\{\{discount\}\}/g, "");
    rendered = rendered.replace(/\{\{paidRow\}\}/g, "");
    rendered = rendered.replace(/\{\{Tuition Fee\}\}/g, "");
    rendered = rendered.replace(/\{\{paymentDetailsRow\}\}/g, "");
    rendered = rendered.replace(/\{\{lateFeeRatePerDay\}\}/g, "150");
    rendered = rendered.replace(
      /\{\{totalInWords\}\}/g,
      "<strong>Sample Total in Words Only</strong>"
    );

    return rendered;
  };

  const handleChallanTemplateSave = async () => {
    if (!challanForm.name?.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    if (!challanForm.htmlContent?.trim()) {
      toast({ title: "HTML content is required", variant: "destructive" });
      return;
    }
    if (!editingChallan && existingChallanTypes.includes(challanForm.type)) {
      toast({
        title: "Template already exists",
        description: `A template for '${CHALLAN_TYPES.find((t) => t.value === challanForm.type)?.label || challanForm.type}' already exists. Only one template per type is allowed.`,
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: challanForm.name.trim(),
      htmlContent: challanForm.htmlContent,
      isDefault: true,
      type: challanForm.type,
    };

    setSavingTemplate("challan");
    try {
      if (editingChallan) {
        await updateFeeChallanTemplate(editingChallan, payload);
        toast({ title: "Template updated successfully" });
      } else {
        await createFeeChallanTemplate(payload);
        toast({ title: "Template added successfully" });
      }
      await refreshFeeChallanTemplates();
      setChallanDialog(false);
      setEditingChallan(null);
    } catch (err) {
      toast({
        title: editingChallan ? "Failed to update template" : "Failed to add template",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingTemplate("");
    }
  };

  const handleChallanTemplateDelete = async (id) => {
    setDeletingTemplate({ type: "challan", id });
    try {
      await deleteFeeChallanTemplate(id);
      await refreshFeeChallanTemplates();
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({
        title: "Failed to delete template",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingTemplate({ type: "", id: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Fee Challan Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Fee Challan Templates
            </CardTitle>
            {isAllChallanTypesConfigured ? (
              <Badge variant="secondary" className="text-xs">
                All 3 Types Configured (1 per type)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {feeChallanTemplates.length}/3 Types Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={challanDialog} onOpenChange={setChallanDialog}>
              {canCreate && (
                isAllChallanTypesConfigured ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="outline">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      All challan types (Standard Installment, Extra Fee, Hostel) already have a template. Edit the existing templates below.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingChallan(null);
                        setChallanForm({
                          name: "",
                          htmlContent: "",
                          type: availableChallanTypes[0]?.value || "INSTALLMENT",
                        });
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                )
              )}
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingChallan ? "Edit" : "Add"} Challan Template
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={challanForm.name}
                      onChange={(e) =>
                        setChallanForm({
                          ...challanForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Standard Monthly Challan"
                    />
                  </div>
                  <div>
                    <Label>Template Type</Label>
                    {editingChallan ? (
                      <div className="pt-1">
                        <Badge variant="outline" className="text-sm font-semibold px-2 py-1">
                          {CHALLAN_TYPES.find((t) => t.value === challanForm.type)?.label || challanForm.type}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Template type cannot be changed once created.
                        </p>
                      </div>
                    ) : (
                      <Select
                        value={challanForm.type}
                        onValueChange={(val) => setChallanForm({ ...challanForm, type: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableChallanTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>HTML Content</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setChallanForm({
                            ...challanForm,
                            htmlContent: challanDesignTemplate,
                          })
                        }
                      >
                        Load Standard Design
                      </Button>
                    </div>
                    <Textarea
                      noMaxLength
                      rows={10}
                      value={challanForm.htmlContent}
                      onChange={(e) =>
                        setChallanForm({
                          ...challanForm,
                          htmlContent: e.target.value,
                        })
                      }
                      placeholder="Enter HTML template with placeholders like {{studentName}}, {{amount}}, etc."
                    />
                  </div>
                  <Button
                    onClick={handleChallanTemplateSave}
                    className="w-full"
                    disabled={savingTemplate === "challan"}
                  >
                    {renderButtonContent(
                      savingTemplate === "challan",
                      editingChallan ? "Updating..." : "Adding...",
                      editingChallan ? "Update" : "Add"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Template Type</TableHead>
                <TableHead className="py-2 px-3 text-sm">Template Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Created Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeChallanTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                    No fee challan templates configured yet. Click "Add Template" to configure one.
                  </TableCell>
                </TableRow>
              ) : (
                feeChallanTemplates.map((template) => {
                  const typeLabel =
                    CHALLAN_TYPES.find((t) => t.value === template.type)?.label || template.type;
                  const isDup = feeChallanTemplates.filter((t) => t.type === template.type).length > 1;

                  return (
                    <TableRow key={template.id || template._id}>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-semibold">
                            {typeLabel}
                          </Badge>
                          {isDup && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              Duplicate Type
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-medium">{template.name}</TableCell>
                      <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex gap-2">
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingChallan(template.id || template._id);
                                    setChallanForm({
                                      name: template.name,
                                      htmlContent: template.htmlContent,
                                      type: template.type,
                                    });
                                    setChallanDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setPreviewChallan(
                                    renderChallanPreview(template.htmlContent, template.type)
                                  )
                                }
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleChallanTemplateDelete(template.id || template._id)}
                                  disabled={
                                    deletingTemplate.type === "challan" &&
                                    deletingTemplate.id === (template.id || template._id)
                                  }
                                >
                                  {deletingTemplate.type === "challan" &&
                                  deletingTemplate.id === (template.id || template._id) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Teacher & Employee ID Card Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Teacher & Employee ID Card Templates
            </CardTitle>
            {hasTeacherIdCardTemplate ? (
              <Badge variant="secondary" className="text-xs">
                Configured (1 template max)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                0/1 Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={teacherIdCardDialog} onOpenChange={setTeacherIdCardDialog}>
              {canCreate && (
                hasTeacherIdCardTemplate ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="outline">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Teacher ID Card template is already configured. Edit the existing template below.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingTeacherIdCard(null);
                        setTeacherIdCardForm({
                          name: "",
                          htmlContent: "",
                        });
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                )
              )}
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTeacherIdCard ? "Edit" : "Add"} Teacher ID Card Template
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={teacherIdCardForm.name}
                      onChange={(e) =>
                        setTeacherIdCardForm({
                          ...teacherIdCardForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Standard Staff ID Card"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>HTML Content</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setTeacherIdCardForm({
                            ...teacherIdCardForm,
                            htmlContent: teacherIdCardDesignTemplate,
                          })
                        }
                      >
                        Load Standard Design
                      </Button>
                    </div>
                    <Textarea
                      noMaxLength
                      rows={10}
                      value={teacherIdCardForm.htmlContent}
                      onChange={(e) =>
                        setTeacherIdCardForm({
                          ...teacherIdCardForm,
                          htmlContent: e.target.value,
                        })
                      }
                      placeholder="Enter HTML template with placeholders like {{name}}, {{designation}}, etc."
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!teacherIdCardForm.name?.trim()) {
                        toast({ title: "Template name is required", variant: "destructive" });
                        return;
                      }
                      if (!teacherIdCardForm.htmlContent?.trim()) {
                        toast({ title: "HTML content is required", variant: "destructive" });
                        return;
                      }
                      if (!editingTeacherIdCard && hasTeacherIdCardTemplate) {
                        toast({ title: "Template already exists", description: "Only one Teacher ID Card template is allowed.", variant: "destructive" });
                        return;
                      }

                      const payload = {
                        name: teacherIdCardForm.name.trim(),
                        htmlContent: teacherIdCardForm.htmlContent,
                        isDefault: true,
                      };

                      if (editingTeacherIdCard) {
                        try {
                          const updated = await updateStaffIDCardTemplate(
                            editingTeacherIdCard,
                            payload
                          );
                          setTeacherIdCardTemplates((prev) =>
                            prev.map((t) => (t.id === editingTeacherIdCard ? updated : t))
                          );
                          toast({ title: "Template updated successfully" });
                          setTeacherIdCardDialog(false);
                        } catch (err) {
                          toast({
                            title: "Error updating template",
                            description: err.message,
                            variant: "destructive",
                          });
                        }
                      } else {
                        try {
                          const newTemplate = await createStaffIDCardTemplate(payload);
                          setTeacherIdCardTemplates((prev) => [...prev, newTemplate]);
                          toast({ title: "Template added successfully" });
                          setTeacherIdCardDialog(false);
                        } catch (err) {
                          toast({
                            title: "Error creating template",
                            description: err.message,
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    className="w-full"
                  >
                    {editingTeacherIdCard ? "Update" : "Add"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Template Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Created Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherIdCardTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">
                    No teacher ID card template configured yet. Click "Add Template" to configure one.
                  </TableCell>
                </TableRow>
              ) : (
                teacherIdCardTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">{template.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingTeacherIdCard(template.id);
                                  setTeacherIdCardForm({
                                    name: template.name,
                                    htmlContent: template.htmlContent,
                                  });
                                  setTeacherIdCardDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewTeacherIdCard(template.htmlContent)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await deleteStaffIDCardTemplate(template.id);
                                    setTeacherIdCardTemplates((prev) =>
                                      prev.filter((t) => t.id !== template.id)
                                    );
                                    toast({ title: "Template deleted" });
                                  } catch (err) {
                                    toast({
                                      title: "Error deleting template",
                                      description: err.message,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student ID Card Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Student ID Card Templates
            </CardTitle>
            {hasStudentIdCardTemplate ? (
              <Badge variant="secondary" className="text-xs">
                Configured (1 template max)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                0/1 Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={studentIdCardDialog} onOpenChange={setStudentIdCardDialog}>
              {canCreate && (
                hasStudentIdCardTemplate ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="outline">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Student ID Card template is already configured. Edit the existing template below.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingStudentIdCard(null);
                        setStudentIdCardForm({
                          name: "",
                          htmlContent: "",
                        });
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                )
              )}
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingStudentIdCard ? "Edit" : "Add"} Student ID Card Template
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={studentIdCardForm.name}
                      onChange={(e) =>
                        setStudentIdCardForm({
                          ...studentIdCardForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Standard Student ID Card"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>HTML Content</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setStudentIdCardForm({
                            ...studentIdCardForm,
                            htmlContent: studentIdCardDesignTemplate,
                          })
                        }
                      >
                        Load Standard Design
                      </Button>
                    </div>
                    <Textarea
                      noMaxLength
                      rows={10}
                      value={studentIdCardForm.htmlContent}
                      onChange={(e) =>
                        setStudentIdCardForm({
                          ...studentIdCardForm,
                          htmlContent: e.target.value,
                        })
                      }
                      placeholder="Enter HTML template with placeholders like {{name}}, {{studentId}}, {{class}}, etc."
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!studentIdCardForm.name?.trim()) {
                        toast({ title: "Template name is required", variant: "destructive" });
                        return;
                      }
                      if (!studentIdCardForm.htmlContent?.trim()) {
                        toast({ title: "HTML content is required", variant: "destructive" });
                        return;
                      }
                      if (!editingStudentIdCard && hasStudentIdCardTemplate) {
                        toast({ title: "Template already exists", description: "Only one Student ID Card template is allowed.", variant: "destructive" });
                        return;
                      }

                      const payload = {
                        name: studentIdCardForm.name.trim(),
                        htmlContent: studentIdCardForm.htmlContent,
                        isDefault: true,
                      };

                      if (editingStudentIdCard) {
                        try {
                          const updated = await updateStudentIDCardTemplate(
                            editingStudentIdCard,
                            payload
                          );
                          setStudentIdCardTemplates((prev) =>
                            prev.map((t) => (t.id === editingStudentIdCard ? updated : t))
                          );
                          toast({ title: "Template updated successfully" });
                          setStudentIdCardDialog(false);
                        } catch (err) {
                          toast({
                            title: "Error updating template",
                            description: err.message,
                            variant: "destructive",
                          });
                        }
                      } else {
                        try {
                          const newTemplate = await createStudentIDCardTemplate(payload);
                          setStudentIdCardTemplates((prev) => [...prev, newTemplate]);
                          toast({ title: "Template added successfully" });
                          setStudentIdCardDialog(false);
                        } catch (err) {
                          toast({
                            title: "Error creating template",
                            description: err.message,
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    className="w-full"
                  >
                    {editingStudentIdCard ? "Update" : "Add"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Template Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Created Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentIdCardTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">
                    No student ID card template configured yet. Click "Add Template" to configure one.
                  </TableCell>
                </TableRow>
              ) : (
                studentIdCardTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">{template.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingStudentIdCard(template.id);
                                  setStudentIdCardForm({
                                    name: template.name,
                                    htmlContent: template.htmlContent,
                                  });
                                  setStudentIdCardDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewStudentIdCard(template.htmlContent)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await deleteStudentIDCardTemplate(template.id);
                                    setStudentIdCardTemplates((prev) =>
                                      prev.filter((t) => t.id !== template.id)
                                    );
                                    toast({ title: "Template deleted" });
                                  } catch (err) {
                                    toast({
                                      title: "Error deleting template",
                                      description: err.message,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report Card Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report Card Templates
            </CardTitle>
            {hasMarksheetTemplate ? (
              <Badge variant="secondary" className="text-xs">
                Configured (1 template max)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                0/1 Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={marksheetDialog} onOpenChange={setMarksheetDialog}>
              {canCreate && (
                hasMarksheetTemplate ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="outline">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Report Card template is already configured. Edit the existing template below.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingMarksheet(null);
                        setMarksheetForm({
                          name: "",
                          htmlContent: "",
                        });
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                )
              )}
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingMarksheet ? "Edit" : "Add"} Report Card Template
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input
                      value={marksheetForm.name}
                      onChange={(e) =>
                        setMarksheetForm({
                          ...marksheetForm,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Standard Report Card"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>HTML Content</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          setMarksheetForm({
                            ...marksheetForm,
                            htmlContent: reportCardDesignTemplate,
                          })
                        }
                      >
                        Load Standard Design
                      </Button>
                    </div>
                    <Textarea
                      noMaxLength
                      rows={10}
                      value={marksheetForm.htmlContent}
                      onChange={(e) =>
                        setMarksheetForm({
                          ...marksheetForm,
                          htmlContent: e.target.value,
                        })
                      }
                      placeholder="Enter HTML template with placeholders like {{studentName}}, {{examName}}, {{subjects}}, etc."
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!marksheetForm.name?.trim()) {
                        toast({ title: "Template name is required", variant: "destructive" });
                        return;
                      }
                      if (!marksheetForm.htmlContent?.trim()) {
                        toast({ title: "HTML content is required", variant: "destructive" });
                        return;
                      }
                      if (!editingMarksheet && hasMarksheetTemplate) {
                        toast({ title: "Template already exists", description: "Only one Report Card template is allowed.", variant: "destructive" });
                        return;
                      }
                      try {
                        const payload = {
                          name: marksheetForm.name.trim(),
                          htmlContent: marksheetForm.htmlContent,
                          isDefault: true,
                        };
                        if (editingMarksheet) {
                          const updatedTemplate = await updateReportCardTemplate(
                            editingMarksheet,
                            payload
                          );
                          setMarksheetTemplates(
                            marksheetTemplates.map((t) =>
                              t.id === editingMarksheet ? updatedTemplate : t
                            )
                          );
                          toast({ title: "Template updated successfully" });
                        } else {
                          const newTemplate = await createReportCardTemplate(payload);
                          setMarksheetTemplates([...marksheetTemplates, newTemplate]);
                          toast({ title: "Template added successfully" });
                        }
                        setMarksheetDialog(false);
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: error.message || "Failed to save template",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full"
                  >
                    {editingMarksheet ? "Update" : "Add"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Template Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Created Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marksheetTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">
                    No report card template configured yet. Click "Add Template" to configure one.
                  </TableCell>
                </TableRow>
              ) : (
                marksheetTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="py-2 px-3 text-sm font-medium">{template.name}</TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingMarksheet(template.id);
                                  setMarksheetForm({
                                    name: template.name,
                                    htmlContent: template.htmlContent,
                                  });
                                  setMarksheetDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewMarksheet(template.htmlContent)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await deleteReportCardTemplate(template.id);
                                    setMarksheetTemplates(
                                      marksheetTemplates.filter((t) => t.id !== template.id)
                                    );
                                    toast({ title: "Template deleted" });
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: error.message || "Failed to delete template",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payroll & Salary Slip Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Payroll & Salary Slip Templates
            </CardTitle>
            {isAllPayrollTypesConfigured ? (
              <Badge variant="secondary" className="text-xs">
                All 2 Types Configured (1 per type)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {payrollTemplates.length}/2 Types Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Dialog open={payrollDialog} onOpenChange={setPayrollDialog}>
              {canCreate && (
                isAllPayrollTypesConfigured ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled variant="outline">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      All payroll template types (Salary Slip, Payroll Sheet) already have a template. Edit the existing templates below.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingPayroll(null);
                        setPayrollForm({
                          name: "",
                          type: availablePayrollTypes[0]?.value || "SALARY_SLIP",
                          htmlContent: "",
                        });
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                )
              )}
              <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {editingPayroll ? "Edit" : "Add"} Payroll Template
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 p-3 flex-1 overflow-y-auto">
                  <div className="grid grid-row-4 gap-4">
                    <Label htmlFor="pay_name" className="text-left">
                      Template Name
                    </Label>
                    <Input
                      id="pay_name"
                      value={payrollForm.name}
                      onChange={(e) =>
                        setPayrollForm({ ...payrollForm, name: e.target.value })
                      }
                      placeholder="e.g. Standard Salary Slip"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-row-4 gap-4">
                    <Label htmlFor="pay_type" className="text-left">
                      Type
                    </Label>
                    {editingPayroll ? (
                      <div className="pt-1 col-span-3">
                        <Badge variant="outline" className="text-sm font-semibold px-2 py-1">
                          {PAYROLL_TYPES.find((t) => t.value === payrollForm.type)?.label || payrollForm.type}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Template type cannot be changed once created.
                        </p>
                      </div>
                    ) : (
                      <Select
                        value={payrollForm.type}
                        onValueChange={(value) =>
                          setPayrollForm({ ...payrollForm, type: value })
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePayrollTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="grid grid-row-4 gap-4">
                    <div className="col-span-4 flex items-center justify-between pt-2 space-y-2">
                      <Label htmlFor="content">HTML Content</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          if (payrollForm.type === "SALARY_SLIP") {
                            setPayrollForm((prev) => ({
                              ...prev,
                              htmlContent: salarySlipTemplate,
                            }));
                          } else if (payrollForm.type === "PAYROLL_SHEET") {
                            setPayrollForm((prev) => ({
                              ...prev,
                              htmlContent: payrollSheetTemplate,
                            }));
                          } else {
                            toast({
                              title: "Please select a type first",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Load Default Design
                      </Button>
                    </div>
                    <div className="col-span-4">
                      <Textarea
                        noMaxLength
                        id="content"
                        value={payrollForm.htmlContent}
                        onChange={(e) =>
                          setPayrollForm({
                            ...payrollForm,
                            htmlContent: e.target.value,
                          })
                        }
                        className="h-[300px] mb-12 font-mono text-xs"
                        placeholder="Enter HTML content..."
                      />
                    </div>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (!payrollForm.name?.trim()) {
                      toast({ title: "Template name is required", variant: "destructive" });
                      return;
                    }
                    if (!payrollForm.htmlContent?.trim()) {
                      toast({ title: "HTML content is required", variant: "destructive" });
                      return;
                    }
                    if (!editingPayroll && existingPayrollTypes.includes(payrollForm.type)) {
                      toast({
                        title: "Template already exists",
                        description: `A template for '${PAYROLL_TYPES.find((t) => t.value === payrollForm.type)?.label || payrollForm.type}' already exists. Only one template per type is allowed.`,
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      const payload = {
                        name: payrollForm.name.trim(),
                        type: payrollForm.type,
                        htmlContent: payrollForm.htmlContent,
                        isDefault: true,
                      };

                      if (editingPayroll) {
                        const updatedTemplate = await updatePayrollTemplate(
                          editingPayroll,
                          payload
                        );
                        setPayrollTemplates(
                          payrollTemplates.map((t) =>
                            t.id === editingPayroll ? updatedTemplate : t
                          )
                        );
                        toast({ title: "Template updated successfully" });
                      } else {
                        const newTemplate = await createPayrollTemplate(payload);
                        setPayrollTemplates([...payrollTemplates, newTemplate]);
                        toast({ title: "Template added successfully" });
                      }
                      setPayrollDialog(false);
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to save template",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full"
                >
                  {editingPayroll ? "Update" : "Add"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-sm">Template Type</TableHead>
                <TableHead className="py-2 px-3 text-sm">Template Name</TableHead>
                <TableHead className="py-2 px-3 text-sm">Created Date</TableHead>
                <TableHead className="py-2 px-3 text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                    No payroll templates configured yet. Click "Add Template" to configure one.
                  </TableCell>
                </TableRow>
              ) : (
                payrollTemplates.map((template) => {
                  const typeLabel =
                    PAYROLL_TYPES.find((t) => t.value === template.type)?.label ||
                    (template.type || "").replace("_", " ");
                  const isDup = payrollTemplates.filter((t) => t.type === template.type).length > 1;

                  return (
                    <TableRow key={template.id}>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-semibold">
                            {typeLabel}
                          </Badge>
                          {isDup && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              Duplicate Type
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-medium">{template.name}</TableCell>
                      <TableCell className="py-2 px-3 text-sm text-muted-foreground">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm">
                        <div className="flex gap-2">
                          {canUpdate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingPayroll(template.id);
                                    setPayrollForm({
                                      name: template.name,
                                      type: template.type,
                                      htmlContent: template.htmlContent,
                                    });
                                    setPayrollDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewPayroll(template.htmlContent)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await deletePayrollTemplate(template.id);
                                      setPayrollTemplates(
                                        payrollTemplates.filter((t) => t.id !== template.id)
                                      );
                                      toast({ title: "Template deleted" });
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: "Failed to delete template",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialogs */}
      <Dialog
        open={!!previewChallan}
        onOpenChange={() => setPreviewChallan(null)}
      >
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Challan Template Preview</DialogTitle>
          </DialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: previewChallan || "",
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewTeacherIdCard}
        onOpenChange={() => setPreviewTeacherIdCard(null)}
      >
        <DialogContent className="max-w-fit max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Teacher ID Card Template Preview</DialogTitle>
          </DialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: previewTeacherIdCard || "",
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewStudentIdCard}
        onOpenChange={() => setPreviewStudentIdCard(null)}
      >
        <DialogContent className="max-w-fit max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Student ID Card Template Preview</DialogTitle>
          </DialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: previewStudentIdCard || "",
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewMarksheet}
        onOpenChange={() => setPreviewMarksheet(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Report Card Template Preview</DialogTitle>
          </DialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: previewMarksheet || "",
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewPayroll}
        onOpenChange={() => setPreviewPayroll(null)}
      >
        <DialogContent className="max-w-7xl max-h-[95dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payroll Template Preview</DialogTitle>
          </DialogHeader>
          <div
            dangerouslySetInnerHTML={{
              __html: previewPayroll || "",
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesTab;
