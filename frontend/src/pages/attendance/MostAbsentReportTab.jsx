import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  X,
  RotateCcw,
  Users,
  UserX,
  Calendar,
  GraduationCap,
  BookOpen,
  ChevronsUpDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import {
  getProgramNames,
  getClasses,
  getSections,
  getAcademicSessions,
  getAttendanceReport,
  getSubjectsForClassWithAssignments,
} from "../../../config/apis";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return String(val._id || val.id || "");
  return String(val);
};

const cleanSubjectName = (name) => {
  if (!name) return "";
  let clean = String(name).trim();
  if (/^[A-Z0-9_-]+\s*-\s*(.+)$/i.test(clean)) {
    clean = clean.replace(/^[A-Z0-9_-]+\s*-\s*/i, "");
  }
  clean = clean.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return clean || name;
};

/**
 * MultiSelectDropdown with Checkboxes for each option item
 */
const CheckboxMultiSelect = ({
  title,
  placeholder = "Select...",
  options = [],
  selected = [],
  onChange,
  disabled = false,
  allLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => (o.label || "").toLowerCase().includes(q));
  }, [options, search]);

  const isAll = options.length > 0 && selected.length === options.length;

  const handleToggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleToggleAll = () => {
    if (isAll) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const displayText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (isAll) return allLabel || `All ${title} (${options.length})`;
    if (selected.length === 1) {
      const match = options.find((o) => o.value === selected[0]);
      return match ? match.label : selected[0];
    }
    return `${selected.length} ${title} Selected`;
  }, [selected, options, placeholder, isAll, allLabel, title]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between text-xs font-normal px-2.5 bg-background border-input hover:bg-muted/30"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        {options.length > 5 && (
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs border rounded bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/20">
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
          >
            {isAll ? "Deselect All" : "Select All"}
          </button>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">No options available</div>
          ) : (
            filtered.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(opt.value)}
                    className="h-3.5 w-3.5 rounded-[3px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="truncate flex-1 font-medium">{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function MostAbsentReportTab({ onBack }) {
  // Filters
  const [reportSessionId, setReportSessionId] = useState("");
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [minAbsenceFilter, setMinAbsenceFilter] = useState("all");

  // Fetch Academic Sessions
  const { data: academicSessions = [] } = useQuery({
    queryKey: ["academicSessions"],
    queryFn: getAcademicSessions,
  });

  const activeSession = useMemo(() => {
    return (
      academicSessions.find(
        (s) => s.isActive === true || s.isActive === "true" || s.isCurrent || s.status === "ACTIVE"
      ) ||
      academicSessions[0] ||
      null
    );
  }, [academicSessions]);
  const activeSessionId = activeSession ? extractId(activeSession) : "";

  // Pre-select active session
  useEffect(() => {
    if (!reportSessionId && activeSessionId) {
      setReportSessionId(activeSessionId);
    }
  }, [activeSessionId, reportSessionId]);

  const selectedSessionObj = useMemo(() => {
    return (
      academicSessions.find((s) => extractId(s) === reportSessionId) ||
      activeSession ||
      null
    );
  }, [academicSessions, reportSessionId, activeSession]);

  // Session Dates
  const sessionStartDate = useMemo(() => {
    if (selectedSessionObj?.startDate) {
      return typeof selectedSessionObj.startDate === "string"
        ? selectedSessionObj.startDate.slice(0, 10)
        : new Date(selectedSessionObj.startDate).toISOString().slice(0, 10);
    }
    return "2026-01-01";
  }, [selectedSessionObj]);

  const sessionEndDate = useMemo(() => {
    if (selectedSessionObj?.endDate) {
      return typeof selectedSessionObj.endDate === "string"
        ? selectedSessionObj.endDate.slice(0, 10)
        : new Date(selectedSessionObj.endDate).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }, [selectedSessionObj]);

  const sessionDateDisplay = useMemo(() => {
    try {
      const s = new Date(`${sessionStartDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const e = new Date(`${sessionEndDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${s} – ${e}`;
    } catch {
      return `${sessionStartDate} – ${sessionEndDate}`;
    }
  }, [sessionStartDate, sessionEndDate]);

  // Fetch Programs, Classes, Sections
  const { data: allPrograms = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: getProgramNames,
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: allSections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: getSections,
  });

  // Options for Program MultiSelect
  const programOptions = useMemo(() => {
    return allPrograms.map((p) => ({
      value: extractId(p),
      label: p.name || p.code || extractId(p),
    }));
  }, [allPrograms]);

  // Filter Classes by selected Program(s)
  const availableClasses = useMemo(() => {
    if (selectedProgramIds.length === 0) return allClasses;
    return allClasses.filter((c) => {
      const pId = extractId(c.programId || c.program);
      return selectedProgramIds.includes(pId);
    });
  }, [allClasses, selectedProgramIds]);

  const classOptions = useMemo(() => {
    return availableClasses.map((c) => ({
      value: extractId(c),
      label: c.name || c.className || extractId(c),
    }));
  }, [availableClasses]);

  // Filter Sections by selected Class(es)
  const availableSections = useMemo(() => {
    if (selectedClassIds.length === 0) return allSections;
    return allSections.filter((s) => {
      const cId = extractId(s.classId || s.class);
      return selectedClassIds.includes(cId);
    });
  }, [allSections, selectedClassIds]);

  const sectionOptions = useMemo(() => {
    return availableSections.map((s) => ({
      value: extractId(s),
      label: s.name || s.sectionName || extractId(s),
    }));
  }, [availableSections]);

  // Cascading Filter Handlers
  const handleProgramsChange = (newProgramIds) => {
    setSelectedProgramIds(newProgramIds);
    // Prune classes that no longer belong to selected programs
    if (newProgramIds.length > 0) {
      setSelectedClassIds((prev) =>
        prev.filter((cId) => {
          const cls = allClasses.find((c) => extractId(c) === cId);
          const pId = extractId(cls?.programId || cls?.program);
          return newProgramIds.includes(pId);
        })
      );
    }
  };

  const handleClassesChange = (newClassIds) => {
    setSelectedClassIds(newClassIds);
    // Prune sections that no longer belong to selected classes
    if (newClassIds.length > 0) {
      setSelectedSectionIds((prev) =>
        prev.filter((sId) => {
          const sec = allSections.find((s) => extractId(s) === sId);
          const cId = extractId(sec?.classId || sec?.class);
          return newClassIds.includes(cId);
        })
      );
    }
  };

  // Fetch subjects if single class selected, or dynamically collect from reports
  const singleClassId = selectedClassIds.length === 1 ? selectedClassIds[0] : null;
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["classSubjectsMostAbsent", singleClassId, reportSessionId],
    queryFn: () => getSubjectsForClassWithAssignments(singleClassId, reportSessionId),
    enabled: Boolean(singleClassId),
  });

  // Query is ready once a Session is selected and at least one Program is chosen (or if user selects classes)
  const isFilterReady = Boolean(
    reportSessionId &&
      (selectedProgramIds.length > 0 || selectedClassIds.length > 0)
  );

  const {
    data: rawReportData = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "mostAbsentReportDataMulti",
      sessionStartDate,
      sessionEndDate,
      reportSessionId,
      selectedProgramIds.join(","),
      selectedClassIds.join(","),
      selectedSectionIds.join(","),
    ],
    queryFn: () => {
      const pParam =
        selectedProgramIds.length > 0 && selectedProgramIds.length < allPrograms.length
          ? selectedProgramIds.join(",")
          : undefined;
      const cParam =
        selectedClassIds.length > 0 && selectedClassIds.length < availableClasses.length
          ? selectedClassIds.join(",")
          : undefined;
      const sParam =
        selectedSectionIds.length > 0 && selectedSectionIds.length < availableSections.length
          ? selectedSectionIds.join(",")
          : undefined;

      return getAttendanceReport(
        sessionStartDate,
        sessionEndDate,
        cParam,
        sParam,
        reportSessionId,
        pParam
      );
    },
    enabled: isFilterReady,
  });

  // Dynamic Subject Options list
  const subjectOptions = useMemo(() => {
    const map = new Map();
    classSubjects.forEach((s) => {
      const sId = extractId(s);
      const sName = cleanSubjectName(s.name || s.subjectName || s.code);
      if (sId && sName && sName.toLowerCase() !== "general") {
        map.set(sId, { value: sId, label: sName });
      }
    });

    (rawReportData || []).forEach((st) => {
      (st.subjects || []).forEach((sub) => {
        const sId = extractId(sub.subjectId || sub.id);
        const sName = cleanSubjectName(sub.subjectName);
        if (sId && sName && sName.toLowerCase() !== "general" && !map.has(sId)) {
          map.set(sId, { value: sId, label: sName });
        }
      });
    });

    return Array.from(map.values());
  }, [classSubjects, rawReportData]);

  // Process and rank students by most absences
  const processedStudents = useMemo(() => {
    if (!rawReportData || !Array.isArray(rawReportData)) return [];

    return rawReportData
      .filter((student) => {
        // Multi-select cohort filtering on client side for guaranteed precision
        const pId = extractId(student.program?._id || student.program?.id || student.program);
        const cId = extractId(student.class?._id || student.class?.id || student.class);
        const sId = extractId(student.section?._id || student.section?.id || student.section);

        if (selectedProgramIds.length > 0 && selectedProgramIds.length < allPrograms.length) {
          if (pId && !selectedProgramIds.includes(pId)) return false;
        }
        if (selectedClassIds.length > 0 && selectedClassIds.length < availableClasses.length) {
          if (cId && !selectedClassIds.includes(cId)) return false;
        }
        if (selectedSectionIds.length > 0 && selectedSectionIds.length < availableSections.length) {
          if (sId && !selectedSectionIds.includes(sId)) return false;
        }
        return true;
      })
      .map((student) => {
        let present = 0;
        let absent = 0;
        let leave = 0;
        let holiday = 0;

        const subjectsToConsider =
          selectedSubjectIds.length === 0
            ? (student.subjects || []).filter(
                (s) => s.subjectName && s.subjectName.toLowerCase() !== "general"
              )
            : (student.subjects || []).filter((s) =>
                selectedSubjectIds.includes(String(s.subjectId || s.id))
              );

        subjectsToConsider.forEach((sub) => {
          (sub.attendance || []).forEach((att) => {
            const st = String(att.status || "").toLowerCase();
            if (st === "present" || st === "short_leave" || st === "half_day" || st === "hd") {
              present++;
            } else if (st === "absent") {
              absent++;
            } else if (st === "leave") {
              leave++;
            } else if (st === "holiday") {
              holiday++;
            }
          });
        });

        const totalClasses = present + absent + leave + holiday;
        const effectiveTotal = totalClasses - holiday > 0 ? totalClasses - holiday : totalClasses;
        const absenceRate =
          effectiveTotal > 0 ? Math.round((absent / effectiveTotal) * 1000) / 10 : 0;
        const attendanceRate =
          effectiveTotal > 0 ? Math.round((present / effectiveTotal) * 1000) / 10 : 0;

        return {
          id: student.id || student._id,
          rollNumber: student.rollNumber || "—",
          name: student.name || `${student.fName || ""} ${student.lName || ""}`.trim() || "Student",
          fatherName:
            student.fatherOrguardian ||
            student.fatherName ||
            student.parentOrGuardianName ||
            "—",
          className: student.class?.name || "Class",
          sectionName: student.section?.name || "",
          programName: student.program?.name || "",
          present,
          absent,
          leave,
          holiday,
          totalClasses,
          effectiveTotal,
          absenceRate,
          attendanceRate,
        };
      })
      .filter((s) => s.absent > 0)
      .sort((a, b) => {
        if (b.absent !== a.absent) return b.absent - a.absent;
        return b.absenceRate - a.absenceRate;
      });
  }, [
    rawReportData,
    selectedProgramIds,
    allPrograms.length,
    selectedClassIds,
    availableClasses.length,
    selectedSectionIds,
    availableSections.length,
    selectedSubjectIds,
  ]);

  // Threshold filter
  const filteredStudents = useMemo(() => {
    if (minAbsenceFilter === "all") return processedStudents;
    const threshold = Number(minAbsenceFilter) || 0;
    return processedStudents.filter((s) => s.absent >= threshold);
  }, [processedStudents, minAbsenceFilter]);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedProgramIds([]);
    setSelectedClassIds([]);
    setSelectedSectionIds([]);
    setSelectedSubjectIds([]);
    setMinAbsenceFilter("all");
  };

  // Print Report Handler
  const printMostAbsentReport = async () => {
    let logoDataUrl = "/logo.png";
    try {
      const res = await fetch("/logo.png");
      if (res.ok) {
        const blob = await res.blob();
        logoDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      logoDataUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/logo.png";
    }

    const sessionLabel = selectedSessionObj?.name || "Active Academic Session";
    const printedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const programLabels =
      selectedProgramIds.length === 0 || selectedProgramIds.length === allPrograms.length
        ? "All Programs"
        : allPrograms
            .filter((p) => selectedProgramIds.includes(extractId(p)))
            .map((p) => p.name)
            .join(", ");

    const classLabels =
      selectedClassIds.length === 0 || selectedClassIds.length === availableClasses.length
        ? "All Classes"
        : availableClasses
            .filter((c) => selectedClassIds.includes(extractId(c)))
            .map((c) => c.name)
            .join(", ");

    const sectionLabels =
      selectedSectionIds.length === 0 || selectedSectionIds.length === availableSections.length
        ? "All Sections"
        : availableSections
            .filter((s) => selectedSectionIds.includes(extractId(s)))
            .map((s) => s.name)
            .join(", ");

    const subjectLabels =
      selectedSubjectIds.length === 0 || selectedSubjectIds.length === subjectOptions.length
        ? "All Subjects (Cumulative)"
        : subjectOptions
            .filter((s) => selectedSubjectIds.includes(s.value))
            .map((s) => s.label)
            .join(", ");

    const rowsHtml = filteredStudents
      .map((s, idx) => {
        return `
          <tr>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; font-size: 9px; color: #0f172a;">
              #${idx + 1}
            </td>
            <td style="padding: 3.5px 6px; border: 1px solid #cbd5e1; font-size: 9.5px; color: #0f172a;">
              <div style="display: flex; align-items: baseline; gap: 6px;">
                <span style="font-family: monospace; font-weight: 700; font-size: 9px; background: #f1f5f9; padding: 1px 4px; border: 1px solid #cbd5e1; border-radius: 3px;">${s.rollNumber}</span>
                <strong style="text-transform: uppercase;">${s.name}</strong>
              </div>
              <div style="font-size: 8px; color: #64748b; margin-top: 1px;">S/D of ${s.fatherName}</div>
            </td>
            <td style="padding: 3px 6px; border: 1px solid #cbd5e1; font-size: 8.5px; color: #334155;">
              ${s.className} ${s.sectionName ? `(${s.sectionName})` : ""}
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 9px;">
              ${s.effectiveTotal}
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; font-size: 10px; color: #dc2626; background: #fff1f2;">
              ${s.absent}
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; color: #166534;">
              ${s.present}
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; color: #92400e;">
              ${s.leave}
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: 9px; color: #dc2626;">
              ${s.absenceRate}%
            </td>
            <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: 9px; color: #0f172a;">
              ${s.attendanceRate}%
            </td>
          </tr>
        `;
      })
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Most Absent Students Report - ${sessionLabel}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600;700&family=Great+Vibes&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; color: #0f172a; padding: 12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #dc2626; padding-bottom: 8px; margin-bottom: 10px; }
          .form-container { margin-bottom: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; }
          .form-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 6px; }
          .form-row:last-child { margin-bottom: 0; }
          .field-label { font-size: 9.5px; font-weight: 700; color: #334155; white-space: nowrap; margin-right: 6px; }
          .field-line { flex: 1; border-bottom: 1.5px solid #64748b; font-size: 10px; font-weight: 600; color: #0f172a; padding: 0 4px 1px 4px; min-height: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; table-layout: fixed; }
          th { background: #f1f5f9; font-weight: 700; border: 1px solid #cbd5e1; padding: 3px 4px; text-align: center; color: #334155; font-size: 9px; }
          td { border: 1px solid #cbd5e1; }
          .footer-signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; padding-top: 10px; font-size: 9.5px; color: #64748b; }
          .sig-line { width: 170px; border-bottom: 1px solid #64748b; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${logoDataUrl}" alt="Logo" style="height: 48px; width: auto; object-fit: contain;" />
            <div>
              <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
                Concordia College Peshawar
              </div>
              <div style="font-family: 'Great Vibes', 'Dancing Script', cursive; font-size: 28px; color: #dc2626; line-height: 1.1; margin-top: 1px;">
                Most Absent Students Report
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9px; color: #64748b;">
            <div><strong>Printed:</strong> ${printedAt}</div>
            <div><strong>Academic Session:</strong> ${sessionLabel}</div>
            <div><strong>Scope:</strong> ${filteredStudents.length} Students Listed</div>
          </div>
        </div>

        <div class="form-container">
          <div class="form-row">
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Academic Session:</span>
              <span class="field-line">${sessionLabel}</span>
            </div>
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Session Period:</span>
              <span class="field-line">${sessionDateDisplay}</span>
            </div>
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Program(s):</span>
              <span class="field-line">${programLabels}</span>
            </div>
          </div>
          <div class="form-row">
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Class &amp; Section:</span>
              <span class="field-line">${classLabels} – ${sectionLabels}</span>
            </div>
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Subject Scope:</span>
              <span class="field-line">${subjectLabels}</span>
            </div>
            <div style="flex: 1.5; display: flex; align-items: baseline;">
              <span class="field-label">Audit Criteria:</span>
              <span class="field-line">Session Absences (Ranked Descending)</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 34px;">Rank</th>
              <th style="width: 220px; text-align: left; padding-left: 6px;">Student Name &amp; Roll Number</th>
              <th style="width: 140px; text-align: left; padding-left: 6px;">Class &amp; Section</th>
              <th style="width: 50px;">Classes</th>
              <th style="width: 56px; background: #fee2e2; color: #991b1b;">Absences</th>
              <th style="width: 48px;">Present</th>
              <th style="width: 48px;">Leaves</th>
              <th style="width: 56px;">Absence %</th>
              <th style="width: 56px;">Att. %</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="9" style="padding: 12px; text-align: center; color: #64748b;">No absent students recorded for this criteria.</td></tr>`}
          </tbody>
        </table>

        <div class="footer-signatures">
          <div>
            <div class="sig-line"></div>
            <div>Prepared By (Class Incharge)</div>
          </div>
          <div>
            <div class="sig-line"></div>
            <div>Verified By (Attendance Auditor)</div>
          </div>
          <div>
            <div class="sig-line"></div>
            <div>Approved By (Principal / Vice Principal)</div>
          </div>
        </div>
      </body>
      </html>
    `;

    await openManagedPrintWindow({
      html: fullHtml,
      title: `Most_Absent_Students_Report_${sessionLabel.replace(/\s+/g, "_")}`,
    });
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-2xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Hub</span>
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                <UserX className="w-4 h-4" />
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                Most Absent Students Report
              </h1>
              <Badge variant="outline" className="text-[10.5px] border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30">
                High Absenteeism Audit
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rank and audit students with the highest absence counts across the selected academic session.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={printMostAbsentReport}
            disabled={!isFilterReady || filteredStudents.length === 0}
            className="h-8 px-3 text-xs gap-1.5 font-semibold bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (PDF)</span>
          </Button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Academic Session */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary" />
                Session (Required)
              </Label>
              <Select value={reportSessionId} onValueChange={setReportSessionId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {academicSessions.map((s) => {
                    const sId = extractId(s);
                    const isAct = s.isActive === true || s.isActive === "true" || s.isCurrent;
                    return (
                      <SelectItem key={sId} value={sId} className="text-xs">
                        {s.name} {isAct ? "(Active)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Program (Checkbox Multi-Select) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-primary" />
                Program
              </Label>
              <CheckboxMultiSelect
                title="Programs"
                placeholder="-- Select Program --"
                allLabel="All Programs"
                options={programOptions}
                selected={selectedProgramIds}
                onChange={handleProgramsChange}
              />
            </div>

            {/* 3. Class (Checkbox Multi-Select) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-primary" />
                Class
              </Label>
              <CheckboxMultiSelect
                title="Classes"
                placeholder="-- Select Class --"
                allLabel="All Classes"
                options={classOptions}
                selected={selectedClassIds}
                onChange={handleClassesChange}
                disabled={classOptions.length === 0}
              />
            </div>

            {/* 4. Section (Checkbox Multi-Select) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3 text-primary" />
                Section
              </Label>
              <CheckboxMultiSelect
                title="Sections"
                placeholder="-- Select Section --"
                allLabel="All Sections"
                options={sectionOptions}
                selected={selectedSectionIds}
                onChange={setSelectedSectionIds}
                disabled={sectionOptions.length === 0}
              />
            </div>

            {/* 5. Subject (Checkbox Multi-Select) */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-primary" />
                Subject (Optional)
              </Label>
              <CheckboxMultiSelect
                title="Subjects"
                placeholder="All Subjects (Combined)"
                allLabel="All Subjects"
                options={subjectOptions}
                selected={selectedSubjectIds}
                onChange={setSelectedSubjectIds}
                disabled={subjectOptions.length === 0}
              />
            </div>
          </div>

          {/* Secondary Controls Bar: Threshold & Session Dates */}
          <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-muted-foreground font-medium">Filter Absences:</span>
              <Select value={minAbsenceFilter} onValueChange={setMinAbsenceFilter}>
                <SelectTrigger className="h-7 text-xs w-36">
                  <SelectValue placeholder="Absence Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Absences (1+)</SelectItem>
                  <SelectItem value="3" className="text-xs">3+ Absences</SelectItem>
                  <SelectItem value="5" className="text-xs">5+ Absences</SelectItem>
                  <SelectItem value="10" className="text-xs">10+ Absences</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Session Period:</span>
              <strong className="text-foreground font-mono">{sessionDateDisplay}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / State Display */}
      {!isFilterReady ? (
        <Card className="border-dashed border-border p-12 text-center bg-card">
          <GraduationCap className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">Select Program or Class to View Report</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Please choose one or more Programs or Classes using the checkbox filters above to analyze absence records for the active session.
          </p>
        </Card>
      ) : isFetching ? (
        <Card className="border-border p-12 text-center bg-card">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
          <p className="text-xs text-muted-foreground">Loading attendance data for session...</p>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-border p-12 text-center bg-card">
          <UserX className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No Absent Students Recorded</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            No students have absences recorded under the selected filters for this session period.
          </p>
        </Card>
      ) : (
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-[11px] border-collapse border border-border">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-[10px]">
                  <th className="py-2 px-2 text-center font-bold text-foreground border border-border w-12">
                    Rank
                  </th>
                  <th className="py-2 px-3 text-left font-bold text-foreground border border-border min-w-[220px]">
                    Student Name &amp; Roll Number
                  </th>
                  <th className="py-2 px-3 text-left font-bold text-foreground border border-border min-w-[140px]">
                    Class &amp; Section
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-foreground border border-border w-16">
                    Classes
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/40 border border-border w-20">
                    Absences
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-foreground border border-border w-16">
                    Present
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-foreground border border-border w-16">
                    Leave
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-rose-600 dark:text-rose-400 border border-border w-20">
                    Absence %
                  </th>
                  <th className="py-2 px-2 text-center font-bold text-foreground border border-border w-20">
                    Att. Rate %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const isTop3 = idx < 3;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-1 px-2 text-center font-black text-foreground border border-border">
                        {isTop3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                              idx === 0
                                ? "bg-amber-400 text-slate-900"
                                : idx === 1
                                ? "bg-slate-300 text-slate-900"
                                : "bg-amber-600 text-white"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Merged Student Name & Roll Number Cell */}
                      <td className="py-1.5 px-3 border border-border">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground text-[10.5px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/60 shrink-0">
                            {s.rollNumber}
                          </span>
                          <span className="font-bold text-foreground text-[11.5px] uppercase">
                            {s.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground pl-0.5 mt-0.5">
                          S/D of {s.fatherName}
                        </div>
                      </td>

                      <td className="py-1 px-3 border border-border text-foreground">
                        <span className="font-medium">{s.className}</span>
                        {s.sectionName && (
                          <span className="text-muted-foreground text-[10px] ml-1">
                            ({s.sectionName})
                          </span>
                        )}
                        {s.programName && (
                          <div className="text-[9.5px] text-muted-foreground truncate">
                            {s.programName}
                          </div>
                        )}
                      </td>

                      <td className="py-1 px-2 text-center font-mono font-semibold text-foreground border border-border">
                        {s.effectiveTotal}
                      </td>

                      <td className="py-1 px-2 text-center border border-border bg-rose-50/40 dark:bg-rose-950/20">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-black font-mono text-xs bg-rose-600 text-white shadow-2xs">
                          {s.absent}
                        </span>
                      </td>

                      <td className="py-1 px-2 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-400 border border-border">
                        {s.present}
                      </td>

                      <td className="py-1 px-2 text-center font-mono font-semibold text-amber-700 dark:text-amber-400 border border-border">
                        {s.leave}
                      </td>

                      <td className="py-1 px-2 text-center font-mono font-bold text-rose-600 dark:text-rose-400 border border-border">
                        {s.absenceRate}%
                      </td>

                      <td className="py-1 px-2 text-center font-mono font-bold text-foreground border border-border">
                        {s.attendanceRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
            <div>
              Showing <strong>{filteredStudents.length}</strong> of <strong>{processedStudents.length}</strong> absent students
            </div>
            <div>
              Ranked by highest absence count in session
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
