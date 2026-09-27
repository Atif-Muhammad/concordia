import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Upload, X, Eye, Edit, Trash2, IdCard, Check, Plus,
    Trash, TrendingUp, Calendar as CalendarIcon, Undo2,
    Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getFeeStructures, getLatestRollNumbersBatch } from "@/services/api";
import { resolveFileUrl } from "@/lib/utils";

const extractId = (val) => {
    if (!val) return "";
    if (typeof val === "object") {
        return (val._id || val.id)?.toString() || "";
    }
    return val.toString();
};

const cleanProgramName = (name) => {
    if (!name) return "";
    return name.replace(/\s*-\s*$/, "").trim();
};

const StudentForm = ({
    initialData = {},
    onSubmit,
    onCancel,
    isEditing = false,
    programs = [],
    classes = [],
    sections = [],
    headerExtra = null,
    rollNumberMap = {},
    isSubmitting = false,
    academicSessions = [],
    feeStructures: propFeeStructures = []
}) => {
    const { toast } = useToast();

    const { data: fetchedFeeStructures = [] } = useQuery({
        queryKey: ['feeStructures'],
        queryFn: getFeeStructures,
        enabled: !propFeeStructures || propFeeStructures.length === 0,
    });
    const allFeeStructures = Array.isArray(propFeeStructures) && propFeeStructures.length > 0
        ? propFeeStructures
        : (Array.isArray(fetchedFeeStructures) ? fetchedFeeStructures : []);
    const safeRollNumberMap = (rollNumberMap && typeof rollNumberMap === "object") ? rollNumberMap : {};

    const [formData, setFormData] = useState(() => {
        let docs = initialData.documents || {};
        if (typeof docs === "string") {
            try { docs = JSON.parse(docs); } catch { docs = {}; }
        }

        // Safely extract string ID helper
        const extractId = (val) => {
            if (!val) return "";
            if (typeof val === "object") {
                return (val._id || val.id)?.toString() || "";
            }
            return val.toString();
        };

        // Pre-load sessionId from academicRecords (backend returns them sorted by LIFO)
        let currentSessionId = extractId(initialData.sessionId);
        if (!currentSessionId && initialData.academicRecords && initialData.academicRecords.length > 0) {
            currentSessionId = extractId(initialData.academicRecords[0]?.sessionId);
        }

        // Resolve session name from academicSessions if not provided directly
        const resolveSessionName = (sessionId, sessionName) => {
            if (sessionName && typeof sessionName === "string") return sessionName;
            if (typeof sessionName === "object" && sessionName?.name) return sessionName.name;
            if (!sessionId) return "";
            const found = Array.isArray(academicSessions) ? academicSessions.find(s => extractId(s) === extractId(sessionId)) : null;
            return found?.name || "";
        };

        return {
            fName: initialData.fName || "",
            lName: initialData.lName || "",
            sessionId: currentSessionId,
            session: resolveSessionName(currentSessionId, initialData.session || ""),
            fatherOrguardian: initialData.fatherOrguardian || "",
            rollNumber: (initialData.rollNumber ?? "").toString(),
            parentOrGuardianEmail: initialData.parentOrGuardianEmail || "",
            parentOrGuardianPhone: initialData.parentOrGuardianPhone || "",
            parentCNIC: initialData.parentCNIC || "",
            studentCnic: initialData.studentCnic || "",
            address: initialData.address || "",
            gender: initialData.gender || "",
            religion: initialData.religion || "",
            dob: initialData.dob && !isNaN(new Date(initialData.dob).getTime()) ? new Date(initialData.dob).toISOString().split('T')[0] : "",
            admissionDate: initialData.admissionDate && !isNaN(new Date(initialData.admissionDate).getTime()) ? new Date(initialData.admissionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            programId: extractId(initialData.programId),
            classId: extractId(initialData.classId),
            sectionId: extractId(initialData.sectionId),
            tuitionFee: initialData.tuitionFee?.toString() || "",
            numberOfInstallments: initialData.numberOfInstallments?.toString() || "1",
            lateFeeFine: initialData.lateFeeFine || 0,
            installments: (initialData.installments || initialData.feeInstallments || []).map(inst => {
                let sessionName = inst.session || "";
                if (typeof sessionName === "object" && sessionName?.name) sessionName = sessionName.name;
                const instSessionId = extractId(inst.sessionId);
                if (!sessionName && instSessionId) {
                    const found = Array.isArray(academicSessions) ? academicSessions.find(s => extractId(s) === extractId(instSessionId)) : null;
                    sessionName = found?.name || "";
                }
                return {
                    ...inst,
                    amount: inst.amount || Number(inst.basePayable) || 0,
                    sessionId: instSessionId,
                    session: sessionName,
                };
            }),
            documents: docs,
            // New fields
            admissionFormNumber: initialData.admissionFormNumber || "",
            previousBoardName: initialData.previousBoardName || "",
            previousBoardRollNumber: initialData.previousBoardRollNumber || "",
            obtainedMarks: initialData.obtainedMarks?.toString() || "",
            totalMarks: initialData.totalMarks?.toString() || "",
        };
    });

    useEffect(() => {
        let docs = initialData.documents || {};
        if (typeof docs === "string") {
            try { docs = JSON.parse(docs); } catch { docs = {}; }
        }

        const extractId = (val) => {
            if (!val) return "";
            if (typeof val === "object") {
                return (val._id || val.id)?.toString() || "";
            }
            return val.toString();
        };

        let currentSessionId = extractId(initialData.sessionId);
        if (!currentSessionId && initialData.academicRecords && initialData.academicRecords.length > 0) {
            currentSessionId = extractId(initialData.academicRecords[0]?.sessionId);
        }

        setFormData({
            fName: initialData.fName || "",
            lName: initialData.lName || "",
            sessionId: currentSessionId,
            session: (() => {
                if (initialData.session && typeof initialData.session === "string") return initialData.session;
                if (typeof initialData.session === "object" && initialData.session?.name) return initialData.session.name;
                if (!currentSessionId) return "";
                const found = Array.isArray(academicSessions) ? academicSessions.find(s => extractId(s) === extractId(currentSessionId)) : null;
                return found?.name || "";
            })(),
            fatherOrguardian: initialData.fatherOrguardian || "",
            rollNumber: (initialData.rollNumber ?? "").toString(),
            parentOrGuardianEmail: initialData.parentOrGuardianEmail || "",
            parentOrGuardianPhone: initialData.parentOrGuardianPhone || "",
            parentCNIC: initialData.parentCNIC || "",
            studentCnic: initialData.studentCnic || "",
            address: initialData.address || "",
            gender: initialData.gender || "",
            religion: initialData.religion || "",
            dob: initialData.dob && !isNaN(new Date(initialData.dob).getTime()) ? new Date(initialData.dob).toISOString().split('T')[0] : "",
            admissionDate: initialData.admissionDate && !isNaN(new Date(initialData.admissionDate).getTime()) ? new Date(initialData.admissionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            programId: extractId(initialData.programId),
            classId: extractId(initialData.classId),
            sectionId: extractId(initialData.sectionId),
            tuitionFee: initialData.tuitionFee?.toString() || "",
            numberOfInstallments: initialData.numberOfInstallments?.toString() || "1",
            lateFeeFine: initialData.lateFeeFine || 0,
            installments: (initialData.installments || initialData.feeInstallments || []).map(inst => {
                let sessionName = inst.session || "";
                if (typeof sessionName === "object" && sessionName?.name) sessionName = sessionName.name;
                const instSessionId = extractId(inst.sessionId);
                if (!sessionName && instSessionId) {
                    const found = Array.isArray(academicSessions) ? academicSessions.find(s => extractId(s) === extractId(instSessionId)) : null;
                    sessionName = found?.name || "";
                }
                return {
                    ...inst,
                    amount: inst.amount || Number(inst.basePayable) || 0,
                    sessionId: instSessionId,
                    session: sessionName,
                };
            }),
            documents: docs,
            // New fields
            admissionFormNumber: initialData.admissionFormNumber || "",
            previousBoardName: initialData.previousBoardName || "",
            previousBoardRollNumber: initialData.previousBoardRollNumber || "",
            obtainedMarks: initialData.obtainedMarks?.toString() || "",
            totalMarks: initialData.totalMarks?.toString() || "",
        });
        setImagePreview(initialData.photo_url || "");
        setImageFile(null);
    }, [initialData]);

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(initialData.photo_url || "");
    const [fieldErrors, setFieldErrors] = useState({});
    const clearFieldError = useCallback((field) => {
        setFieldErrors(prev => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);
    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        clearFieldError(field);
    }, [clearFieldError]);

    const { data: fetchedRollNumberBatch = {} } = useQuery({
        queryKey: ['latest-roll-numbers-batch', formData.sessionId],
        queryFn: () => getLatestRollNumbersBatch(formData.sessionId),
        enabled: !isEditing,
        staleTime: 5000,
    });
    const activeRollNumberMap = useMemo(() => {
        return {
            ...(fetchedRollNumberBatch && typeof fetchedRollNumberBatch === 'object' ? fetchedRollNumberBatch : {}),
            ...safeRollNumberMap,
        };
    }, [fetchedRollNumberBatch, safeRollNumberMap]);

    // === CALCULATED FIELDS ===

    const selectedProgram = useMemo(() => {
        const pId = extractId(formData.programId);
        if (!pId || !Array.isArray(programs)) return null;
        return programs.find(p => extractId(p) === pId) || null;
    }, [programs, formData.programId]);

    const availableClasses = useMemo(() => {
        if (selectedProgram?.classes && Array.isArray(selectedProgram.classes) && selectedProgram.classes.length > 0) {
            return selectedProgram.classes;
        }
        const pId = extractId(formData.programId);
        if (!pId || !Array.isArray(classes)) return [];
        return classes.filter(c => {
            if (!c) return false;
            return extractId(c.programId) === pId;
        });
    }, [selectedProgram, classes, formData.programId]);

    const selectedClass = useMemo(() => {
        const cId = extractId(formData.classId);
        if (!cId) return null;
        return (selectedProgram?.classes && Array.isArray(selectedProgram.classes)
            ? selectedProgram.classes.find(c => extractId(c) === cId)
            : null)
            || (Array.isArray(classes) ? classes.find(c => extractId(c) === cId) : null)
            || null;
    }, [selectedProgram, classes, formData.classId]);

    const findFeeStructureForClass = useCallback((classId, clsObj) => {
        if (!classId) return null;
        const cId = extractId(classId);
        const feeList = Array.isArray(allFeeStructures) ? allFeeStructures : [];

        // 1. Direct match in allFeeStructures
        const directMatch = feeList.find(fs => {
            if (!fs) return false;
            const fsClassId = extractId(fs.classId || fs.class);
            return fsClassId === cId;
        });
        if (directMatch) return directMatch;

        // 2. Match in clsObj or classes or selectedProgram.classes
        const cls = clsObj
            || (Array.isArray(classes) ? classes.find(c => extractId(c) === cId) : null)
            || (Array.isArray(selectedProgram?.classes) ? selectedProgram.classes.find(c => extractId(c) === cId) : null);
        if (cls?.feeStructures && Array.isArray(cls.feeStructures) && cls.feeStructures.length > 0) {
            return cls.feeStructures[0];
        }
        return null;
    }, [allFeeStructures, classes, selectedProgram]);

    const currentClassFeeStructure = useMemo(() => {
        return findFeeStructureForClass(formData.classId, selectedClass);
    }, [findFeeStructureForClass, formData.classId, selectedClass]);

    const classAllowsSections = useMemo(() => {
        if (!formData.classId || !selectedClass) return false;
        return selectedClass.allowSections !== false;
    }, [formData.classId, selectedClass]);

    const availableSections = useMemo(() => {
        const cId = extractId(formData.classId);
        if (!cId || !classAllowsSections || !Array.isArray(sections)) return [];
        return sections.filter(sec => {
            if (!sec) return false;
            return extractId(sec.classId) === cId;
        });
    }, [sections, formData.classId, classAllowsSections]);

    const hasSections = useMemo(() =>
        classAllowsSections && ((selectedClass?.sections && selectedClass.sections.length > 0) || availableSections.length > 0),
        [classAllowsSections, selectedClass, availableSections]
    );

    useEffect(() => {
        if (formData.classId && selectedClass && selectedClass.allowSections === false && formData.sectionId) {
            setFormData(prev => ({ ...prev, sectionId: "" }));
            clearFieldError("sectionId");
        }
    }, [formData.classId, selectedClass, formData.sectionId, clearFieldError]);

    useEffect(() => {
        if (!isEditing && currentClassFeeStructure && (!formData.installments || formData.installments.length === 0) && (!formData.tuitionFee || formData.tuitionFee === "0" || formData.tuitionFee === "")) {
            const stdFeeAmount = currentClassFeeStructure.totalAmount?.toString() || "";
            const stdInstallmentsCount = currentClassFeeStructure.installments || 1;
            setFormData(prev => ({
                ...prev,
                tuitionFee: stdFeeAmount,
                numberOfInstallments: stdInstallmentsCount.toString(),
                installments: redistributeInstallments(stdFeeAmount, [], stdInstallmentsCount),
            }));
            clearFieldError("tuitionFee");
            clearFieldError("feePlan");
            clearFieldError("installments");
        }
    }, [isEditing, currentClassFeeStructure, formData.classId]);

    const selectedSessionName = useMemo(() => {
        if (formData.session) return formData.session;
        const sessId = extractId(formData.sessionId);
        if (!sessId || !Array.isArray(academicSessions)) return "";
        const found = academicSessions.find(s => extractId(s) === sessId);
        return found?.name || "";
    }, [academicSessions, formData.session, formData.sessionId]);

    const applySelectedSessionToInstallment = (inst) => ({
        ...inst,
        session: selectedSessionName || inst.session || "",
        sessionId: formData.sessionId || inst.sessionId || null,
        classId: formData.classId || inst.classId || null,
        programId: formData.programId || inst.programId || null,
        basePayable: Number(inst.amount) || Number(inst.basePayable) || 0,
        totalAmount: Number(inst.amount) || Number(inst.totalAmount) || 0,
    });

    // === ROLL NUMBER LOGIC ===

    const calculatedPrefix = useMemo(() => {
        const cId = extractId(formData.classId);
        const pId = extractId(formData.programId);
        if (!cId || !Array.isArray(programs) || programs.length === 0) return "";
        const prog = programs.find(p => extractId(p) === pId);
        const cls = Array.isArray(classes) ? classes.find(c => extractId(c) === cId) : null;
        const pPrefix = prog?.rollPrefix || "";
        const cPrefix = cls?.rollPrefix || "";

        // Check for overlap
        if (pPrefix && cPrefix && cPrefix.startsWith(pPrefix)) {
            return cPrefix;
        }
        return `${pPrefix}${cPrefix}`;
    }, [formData.classId, formData.programId, programs, classes]);

    const selectedYearSub = useMemo(() => {
        const sessId = extractId(formData.sessionId);
        if (sessId && Array.isArray(academicSessions)) {
            const sessionRecord = academicSessions.find(s => extractId(s) === sessId);
            const match = sessionRecord?.name?.match(/(\d{4})/);
            if (match) return match[1].slice(-2);
        }
        return new Date().getFullYear().toString().slice(-2);
    }, [academicSessions, formData.sessionId]);

    const [prevPrefix, setPrevPrefix] = useState("");

    const rollNumberSuffix = useMemo(() => {
        const rollStr = (formData.rollNumber ?? "").toString();
        if (calculatedPrefix && rollStr.startsWith(calculatedPrefix)) {
            return rollStr.slice(calculatedPrefix.length);
        }
        // If it doesn't match the NEW prefix, check if it matches the PREVIOUS one
        // This ensures the input box doesn't temporarily show the full roll number during transitions
        if (prevPrefix && rollStr.startsWith(prevPrefix)) {
            return rollStr.slice(prevPrefix.length);
        }
        return rollStr;
    }, [formData.rollNumber, calculatedPrefix, prevPrefix]);
    const sessionManuallySet = useRef(isEditing ? true : false);
    const prevPrefixRef = useRef("");
    const lastAutoRollNumberRef = useRef("");
    // Helper to extract year gap from program duration (e.g., "4 years" -> 4)
    const getProgramGap = (prog) => {
        if (!prog?.duration) return 1;
        const match = prog.duration.match(/\d+/);
        return match ? parseInt(match[0], 10) : 1;
    };

    // Helper to generate session string from a date and gap
    const getSessionLabel = (date, gap = 1) => {
        if (!date) return "";
        const d = new Date(date);
        const y = d.getFullYear();
        const m = d.getMonth(); // 0-indexed
        // Academic year: if month >= April (3), session is y-(y+gap), else (y-1)-(y+gap-1)
        if (m >= 3) return `${y}-${y + gap}`;
        return `${y - 1}-${y + gap - 1}`;
    };

    useEffect(() => {
        const prevPrefix = prevPrefixRef.current;
        const cachedRoll = activeRollNumberMap[calculatedPrefix]
            || activeRollNumberMap[`${calculatedPrefix}${selectedYearSub}-`]
            || activeRollNumberMap[calculatedPrefix.replace(/-+$/, '')];
        if (calculatedPrefix && (calculatedPrefix !== prevPrefix || (!isEditing && cachedRoll))) {
            if (isEditing) {
                const currentRoll = (formData.rollNumber ?? "").toString();
                if (prevPrefix && currentRoll.startsWith(prevPrefix)) {
                    const numericPart = currentRoll.slice(prevPrefix.length);
                    setFormData(prev => ({ ...prev, rollNumber: `${calculatedPrefix}${numericPart}` }));
                } else if (!currentRoll || currentRoll === prevPrefix) {
                    setFormData(prev => ({ ...prev, rollNumber: calculatedPrefix }));
                }
            } else {
                const nextRollNumber = cachedRoll?.nextSuffix?.startsWith(`${selectedYearSub}-`)
                    ? (cachedRoll.nextRollNumber || `${calculatedPrefix}${cachedRoll.nextSuffix}`)
                    : `${calculatedPrefix}${selectedYearSub}-001`;
                const currentRoll = (formData.rollNumber ?? "").toString();
                if (nextRollNumber !== currentRoll && (calculatedPrefix !== prevPrefix || !currentRoll || currentRoll === lastAutoRollNumberRef.current || currentRoll === prevPrefix)) {
                    lastAutoRollNumberRef.current = nextRollNumber;
                    setFormData(prev => ({ ...prev, rollNumber: nextRollNumber }));
                    clearFieldError("rollNumber");
                }
            }
            setPrevPrefix(calculatedPrefix);
            prevPrefixRef.current = calculatedPrefix;
        }
    }, [calculatedPrefix, isEditing, formData.rollNumber, prevPrefix, activeRollNumberMap, selectedYearSub, clearFieldError]);

    useEffect(() => {
        if (!formData.programId || !formData.admissionDate || sessionManuallySet.current || isEditing || !academicSessions.length) return;

        // Auto-select active session if available
        const activeSession = academicSessions.find(s => s.isActive);
        if (activeSession && !formData.sessionId) {
            setFormData(prev => ({ 
                ...prev, 
                sessionId: extractId(activeSession),
                session: activeSession.name 
            }));
        }
    }, [formData.programId, formData.admissionDate, academicSessions, formData.sessionId, isEditing]);

    // Resolve session name once academicSessions loads (handles pre-loaded sessionId from inquiry)
    useEffect(() => {
        if (!academicSessions.length || !formData.sessionId || formData.session) return;
        const found = academicSessions.find(s => extractId(s) === extractId(formData.sessionId));
        if (found) {
            setFormData(prev => ({ ...prev, session: found.name }));
        }
    }, [academicSessions, formData.sessionId, formData.session]);

    // === HANDLERS ===

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const error = validateImageFile(file);
            if (error) {
                setFieldErrors(prev => ({ ...prev, photo: error }));
                e.target.value = "";
                return;
            }
            setFieldErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleImageDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const error = validateImageFile(file);
            if (error) {
                setFieldErrors(prev => ({ ...prev, photo: error }));
                return;
            }
            setFieldErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const redistributeInstallments = (total, installments, targetCount = null) => {
        const totalAmount = Number(total) || 0;
        let currentInstallments = [...installments];

        const gap = getProgramGap(selectedProgram);

        // If targetCount is provided, adjust the array size
        if (targetCount !== null) {
            const count = parseInt(targetCount) || 1;
            if (currentInstallments.length < count) {
                // Add new empty installments
                const toAdd = count - currentInstallments.length;
                for (let i = 0; i < toAdd; i++) {
                    const nextDate = new Date();
                    nextDate.setMonth(nextDate.getMonth() + currentInstallments.length);
                    const monthName = nextDate.toLocaleString('default', { month: 'long' });

                    currentInstallments.push({
                        installmentNumber: currentInstallments.length + 1,
                        amount: 0,
                        dueDate: nextDate.toISOString().split('T')[0],
                        month: monthName,
                        session: selectedSessionName || getSessionLabel(nextDate, gap),
                        sessionId: formData.sessionId || null,
                    });
                }
            } else if (currentInstallments.length > count) {
                // Only remove unpaid installments from the end
                let toRemove = currentInstallments.length - count;
                while (toRemove > 0 && currentInstallments.length > count) {
                    const last = currentInstallments[currentInstallments.length - 1];
                    if ((last.paidAmount || 0) > 0 || last.status === 'PAID' || last.status === 'PARTIAL') break;
                    currentInstallments.pop();
                    toRemove--;
                }
            }
        }

        if (!currentInstallments.length) return [];

        // Separate locked (paid/partial) and unlocked installments
        const lockedSum = currentInstallments.reduce((sum, inst) => {
            if ((inst.paidAmount || 0) > 0 || inst.status === 'PAID' || inst.status === 'PARTIAL') {
                return sum + (Number(inst.amount) || 0);
            }
            return sum;
        }, 0);

        const unlocked = currentInstallments.filter(inst =>
            (inst.paidAmount || 0) === 0 && inst.status !== 'PAID' && inst.status !== 'PARTIAL'
        );

        const remainingToDistribute = Math.max(0, totalAmount - lockedSum);
        const unlockedCount = unlocked.length;

        if (unlockedCount > 0) {
            const baseAmount = Math.floor(remainingToDistribute / unlockedCount);
            const remainder = remainingToDistribute - (baseAmount * unlockedCount);
            let unlockedIdx = 0;

            return currentInstallments.map((inst, index) => {
                // Keep paid installments locked
                if ((inst.paidAmount || 0) > 0 || inst.status === 'PAID' || inst.status === 'PARTIAL') {
                    return applySelectedSessionToInstallment({ ...inst, installmentNumber: index + 1 });
                }
                // Distribute to unlocked
                const isLastUnlocked = unlockedIdx === unlockedCount - 1;
                const amt = isLastUnlocked ? baseAmount + remainder : baseAmount;
                unlockedIdx++;
                return applySelectedSessionToInstallment({ ...inst, installmentNumber: index + 1, amount: amt });
            });
        }

        // All locked — just renumber
        return currentInstallments.map((inst, index) => ({
            ...applySelectedSessionToInstallment(inst),
            installmentNumber: index + 1,
        }));
    };

    const handleAddInstallment = () => {
        const nextNum = formData.installments.length + 1;

        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + formData.installments.length);

        const gap = getProgramGap(selectedProgram);

        const monthName = nextDate.toLocaleString('default', { month: 'long' });

        const newInstallments = [
            ...formData.installments,
            {
                installmentNumber: nextNum,
                amount: 0,
                dueDate: nextDate.toISOString().split('T')[0],
                month: monthName,
                session: selectedSessionName || getSessionLabel(nextDate, gap),
                sessionId: formData.sessionId || null,
            }
        ];

        setFormData(prev => ({
            ...prev,
            numberOfInstallments: newInstallments.length.toString(),
            installments: redistributeInstallments(prev.tuitionFee, newInstallments.map(inst => ({
                ...inst,
                session: selectedSessionName || prev.session || inst.session,
                sessionId: prev.sessionId || inst.sessionId || null,
            })))
        }));
        clearFieldError("installments");
        clearFieldError("numberOfInstallments");
    };

    const handleRemoveInstallment = (index) => {
        const newInstallments = formData.installments.filter((_, i) => i !== index);
        setFormData(prev => ({
            ...prev,
            numberOfInstallments: newInstallments.length.toString(),
            installments: redistributeInstallments(prev.tuitionFee, newInstallments)
        }));
        clearFieldError("installments");
        clearFieldError("numberOfInstallments");
    };

    const handleInstallmentChange = (index, field, value) => {
        const newInstallments = [...formData.installments];
        const oldVal = newInstallments[index][field];
        newInstallments[index] = { ...newInstallments[index], [field]: value };

        // Guard: when changing amount, update tuitionFee and check total doesn't exceed standard fee
        if (field === 'amount') {
            const standardFee = (currentClassFeeStructure || selectedClass?.feeStructures?.[0])?.totalAmount || 0;
            const newTotal = newInstallments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);

            if (standardFee > 0 && newTotal > standardFee) {
                // Cap the specific installment so the total remains at standardFee
                const allowedAdjustment = standardFee - (newTotal - Number(value));
                newInstallments[index].amount = Math.max(Number(newInstallments[index].paidAmount || 0), allowedAdjustment);
                
                const cappedTotal = newInstallments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
                
                toast({
                    title: "Adjustment Capped",
                    description: `Total cannot exceed standard fee (Rs. ${standardFee}). Adjustment capped at Rs. ${newInstallments[index].amount}.`,
                    variant: "default"
                });

                setFormData(prev => ({
                    ...prev,
                    installments: newInstallments,
                    tuitionFee: cappedTotal.toString()
                }));
                clearFieldError("installments");
                clearFieldError("tuitionFee");
                return;
            }

            setFormData(prev => ({
                ...prev,
                installments: newInstallments,
                tuitionFee: newTotal.toString()
            }));
            clearFieldError("installments");
            clearFieldError("tuitionFee");
            return;
        }

        setFormData(prev => ({ ...prev, installments: newInstallments }));
        clearFieldError("installments");
    };

    const toggleDocument = (key) => {
        setFormData(prev => ({
            ...prev,
            documents: {
                ...prev.documents,
                [key]: !prev.documents?.[key]
            }
        }));
    };

    const internalSubmit = () => {
        const prog = Array.isArray(programs) ? programs.find(p => extractId(p) === extractId(formData.programId)) : null;
        const clsWithFee = (Array.isArray(prog?.classes) ? prog.classes.find(c => extractId(c) === extractId(formData.classId)) : null)
            || (Array.isArray(classes) ? classes.find(c => extractId(c) === extractId(formData.classId)) : null);
        const fee = currentClassFeeStructure || findFeeStructureForClass(formData.classId, clsWithFee);
        const standardFee = fee?.totalAmount || selectedClass?.feeStructures?.[0]?.totalAmount || 0;
        const totalInstallmentsAmount = (formData.installments || []).reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
        const agreedTuitionFee = Number(formData.tuitionFee) || 0;
        const hasInvalidDates = (formData.installments || []).some(inst => !inst.dueDate || isNaN(new Date(inst.dueDate).getTime()));
        const validationErrors = {
            fName: firstError(validateRequired(formData.fName, "First name"), validateMaxLength(formData.fName, INPUT_LIMITS.name, "First name")),
            lName: validateMaxLength(formData.lName, INPUT_LIMITS.name, "Last name"),
            sessionId: validateRequired(formData.sessionId, "Session"),
            fatherOrguardian: firstError(validateRequired(formData.fatherOrguardian, "Father/Guardian"), validateMaxLength(formData.fatherOrguardian, INPUT_LIMITS.name, "Father/Guardian")),
            rollNumber: firstError(validateRequired(formData.rollNumber, "Roll number"), validateMaxLength(formData.rollNumber, INPUT_LIMITS.roll, "Roll number")),
            parentOrGuardianEmail: validateEmail(formData.parentOrGuardianEmail),
            parentOrGuardianPhone: firstError(validateRequired(formData.parentOrGuardianPhone, "Parent phone"), validatePkPhone(formData.parentOrGuardianPhone)),
            parentCNIC: validateCnic(formData.parentCNIC),
            studentCnic: validateCnic(formData.studentCnic),
            programId: validateRequired(formData.programId, "Program"),
            classId: validateRequired(formData.classId, "Class"),
            sectionId: classAllowsSections ? validateRequired(formData.sectionId, "Section") : "",
            gender: validateRequired(formData.gender, "Gender"),
            dob: validateRequired(formData.dob, "Date of birth"),
            admissionDate: validateRequired(formData.admissionDate, "Admission date"),
            address: validateMaxLength(formData.address, INPUT_LIMITS.longText, "Address"),
            religion: validateMaxLength(formData.religion, INPUT_LIMITS.name, "Religion"),
            tuitionFee: firstError(
                validateNonNegativeNumber(formData.tuitionFee, "Tuition fee"),
                standardFee > 0 && Number(formData.tuitionFee) > standardFee
                    ? `Agreed fee cannot exceed standard fee (Rs. ${standardFee}).`
                    : ""
            ),
            numberOfInstallments: validateNonNegativeNumber(formData.numberOfInstallments, "Number of installments"),
            lateFeeFine: validateNonNegativeNumber(formData.lateFeeFine, "Late fee fine"),
            previousBoardName: validateMaxLength(formData.previousBoardName, INPUT_LIMITS.name, "Previous board name"),
            previousBoardRollNumber: validateMaxLength(formData.previousBoardRollNumber, INPUT_LIMITS.roll, "Previous board roll number"),
            obtainedMarks: validateNonNegativeNumber(formData.obtainedMarks, "Obtained marks"),
            totalMarks: validateNonNegativeNumber(formData.totalMarks, "Total marks"),
            photo: validateImageFile(imageFile),
            feePlan: !fee ? "Installment plan is required for the selected class." : "",
            installments: !formData.installments?.length
                ? "Please define at least one installment."
                : hasInvalidDates
                    ? "All installments must have a valid due date."
                    : totalInstallmentsAmount !== agreedTuitionFee
                        ? `Installment total must equal agreed tuition fee (Rs. ${agreedTuitionFee}).`
                        : "",
        };
        Object.keys(validationErrors).forEach(key => {
            if (!validationErrors[key]) delete validationErrors[key];
        });
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            toast({
                title: "Validation Error",
                description: "Please fix the highlighted fields.",
                variant: "destructive"
            });
            return;
        }
        setFieldErrors({});

        const normalizedInstallments = (formData.installments || []).map(applySelectedSessionToInstallment);

        const allowedFields = [
            'fName', 'lName', 'fatherOrguardian', 'rollNumber',
            'parentOrGuardianEmail', 'parentOrGuardianPhone', 'parentCNIC', 'address',
            'gender', 'religion', 'dob', 'admissionDate', 'programId', 'classId', 'sectionId',
            'tuitionFee', 'numberOfInstallments', 'lateFeeFine',
            'installments', 'documents', 'status', 'session', 'sessionId', 'studentCnic',
            'admissionFormNumber', 'previousBoardName', 'previousBoardRollNumber',
            'obtainedMarks', 'totalMarks',
        ];

        const submissionData = new FormData();
        allowedFields.forEach(key => {
            if (key === 'installments' || key === 'documents') {
                submissionData.append(key, JSON.stringify(key === 'installments' ? normalizedInstallments : (formData[key] || {})));
            } else if (key === 'sectionId') {
                const secVal = classAllowsSections ? (formData.sectionId || '') : '';
                if (secVal) {
                    submissionData.append(key, secVal);
                }
            } else if (formData[key] !== undefined && formData[key] !== null) {
                submissionData.append(key, formData[key]);
            }
        });

        if (imageFile) {
            submissionData.append('photo', imageFile);
        } else if (!imagePreview && initialData?.photo_url) {
            submissionData.append('removePhoto', 'true');
            submissionData.append('photo_url', '');
        }

        onSubmit(submissionData);
    };

    return (
        <div className="space-y-6">
            {headerExtra}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* LEFT — PHOTO */}
                <div className="md:col-span-1 space-y-2">
                    <Label>Photo *</Label>
                    <div
                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors relative group"
                        onClick={() => document.getElementById('photo-input').click()}
                    >
                        {imagePreview ? (
                            <div className="relative inline-block w-32 h-32">
                                <img
                                    src={resolveFileUrl(imagePreview)}
                                    alt="preview"
                                    className="w-full h-full rounded-full object-cover border-2 border-border"
                                />
                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Upload className="text-white w-8 h-8" />
                                </div>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full shadow-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImagePreview("");
                                        setImageFile(null);
                                        setFieldErrors(prev => { const next = { ...prev }; delete next.photo; return next; });
                                    }}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="py-4">
                                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-xs text-muted-foreground">
                                    Click or drag to upload photo
                                </p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold">
                                    PNG, JPG, JPEG. Max 10MB
                                </p>
                            </div>
                        )}
                        <input
                            id="photo-input"
                            type="file"
                            accept={IMAGE_UPLOAD_RULES.accept}
                            className="hidden"
                            onChange={handleImageChange}
                        />
                    </div>
                    <FieldError message={fieldErrors.photo} />
                </div>

                {/* RIGHT — FORM */}
                <div className="md:col-span-3">
                    <div className="grid grid-cols-3 gap-4">
                        {/* Names */}
                        <div>
                            <Label>First Name *</Label>
                            <Input
                                value={formData.fName}
                                onChange={(e) => updateField("fName", e.target.value)}
                                placeholder="John"
                                className={fieldErrors.fName ? "border-destructive" : ""}
                            />
                            <FieldError message={fieldErrors.fName} />
                        </div>
                        <div>
                            <Label>Last Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                                value={formData.lName}
                                onChange={(e) => updateField("lName", e.target.value)}
                                placeholder="Doe"
                                className={fieldErrors.lName ? "border-destructive" : ""}
                            />
                            <FieldError message={fieldErrors.lName} />
                        </div>
                        <div>
                            <Label>Session *</Label>
                            <Select
                                value={formData.sessionId ? formData.sessionId.toString() : ""}
                                onValueChange={(v) => {
                                    const sessionRecord = Array.isArray(academicSessions) ? academicSessions.find(s => extractId(s) === v) : null;
                                    sessionManuallySet.current = true;
                                    setFormData(prev => ({
                                        ...prev,
                                        sessionId: v,
                                        session: sessionRecord?.name || "",
                                        installments: (prev.installments || []).map(inst => ({
                                            ...inst,
                                            session: sessionRecord?.name || "",
                                            sessionId: v
                                        }))
                                    }));
                                    clearFieldError("sessionId");
                                }}
                            >
                                <SelectTrigger className={`w-full ${fieldErrors.sessionId ? "border-destructive" : ""}`}>
                                    <SelectValue placeholder="Select Session" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicSessions.map(s => {
                                        const sId = extractId(s);
                                        if (!sId) return null;
                                        return (
                                            <SelectItem key={sId} value={sId}>
                                                {s.name} {s.isActive ? "(Current)" : ""}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FieldError message={fieldErrors.sessionId} />
                        </div>

                        {/* Program, Class, Section */}
                        <div>
                            <Label>Program *</Label>
                            <Select
                                value={formData.programId ? formData.programId.toString() : ""}
                                onValueChange={(v) => {
                                    setFormData(prev => ({ ...prev, programId: v, classId: "", sectionId: "" }));
                                    clearFieldError("programId");
                                    clearFieldError("classId");
                                }}
                            >
                                <SelectTrigger className={fieldErrors.programId ? "border-destructive" : ""}><SelectValue placeholder="Select Program" /></SelectTrigger>
                                <SelectContent>
                                    {programs.map(p => {
                                        const pId = extractId(p);
                                        if (!pId) return null;
                                        const deptName = p.department?.name || (typeof p.departmentId === "object" ? p.departmentId?.name : "");
                                        return (
                                            <SelectItem key={pId} value={pId}>
                                                {cleanProgramName(p.name)}{deptName ? ` - ${deptName}` : ""}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FieldError message={fieldErrors.programId} />
                        </div>
                        <div>
                            <Label>Class *</Label>
                            <Select
                                value={formData.classId ? formData.classId.toString() : ""}
                                onValueChange={(v) => {
                                    const prog = Array.isArray(programs) ? programs.find(p => extractId(p) === extractId(formData.programId)) : null;
                                    const clsWithFee = (Array.isArray(prog?.classes) ? prog.classes.find(c => extractId(c) === v) : null)
                                        || (Array.isArray(classes) ? classes.find(c => extractId(c) === v) : null);
                                    const fee = findFeeStructureForClass(v, clsWithFee);

                                    if (!fee) {
                                        toast({
                                            title: "No Installment Plan",
                                            description: "The selected class does not have an installment plan. Please create one in Fee Management first.",
                                            variant: "destructive"
                                        });
                                    }

                                    const stdFeeAmount = fee?.totalAmount?.toString() || "";
                                    const stdInstallmentsCount = fee?.installments || 1;

                                    setFormData(prev => {
                                        const newTuitionFee = !isEditing ? stdFeeAmount : prev.tuitionFee;
                                        const newNumInst = !isEditing ? stdInstallmentsCount.toString() : prev.numberOfInstallments;

                                        return {
                                            ...prev,
                                            classId: v,
                                            sectionId: "",
                                            tuitionFee: newTuitionFee,
                                            numberOfInstallments: newNumInst,
                                            installments: !isEditing
                                                ? redistributeInstallments(newTuitionFee, [], stdInstallmentsCount)
                                                : prev.installments
                                        };
                                    });
                                    clearFieldError("classId");
                                    clearFieldError("sectionId");
                                    clearFieldError("feePlan");
                                    clearFieldError("installments");
                                }}
                                disabled={!formData.programId}
                            >
                                <SelectTrigger className={fieldErrors.classId ? "border-destructive" : ""}>
                                    <SelectValue placeholder="Select Class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableClasses.map(c => {
                                        const cId = extractId(c);
                                        if (!cId) return null;
                                        return (
                                            <SelectItem key={cId} value={cId}>{c.name || "Unnamed Class"}</SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <FieldError message={fieldErrors.classId || fieldErrors.feePlan} />
                        </div>
                        <div>
                            <Label className={!formData.classId || !classAllowsSections ? "text-muted-foreground" : ""}>
                                Section {classAllowsSections ? "*" : ""}
                            </Label>
                            {classAllowsSections ? (
                                <Select
                                    value={formData.sectionId ? formData.sectionId.toString() : ""}
                                    onValueChange={(v) => updateField("sectionId", v)}
                                    disabled={!formData.classId}
                                >
                                    <SelectTrigger className={fieldErrors.sectionId ? "border-destructive" : ""}>
                                        <SelectValue placeholder="Select Section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSections.map(s => {
                                            const sId = extractId(s);
                                            if (!sId) return null;
                                            return (
                                                <SelectItem key={sId} value={sId}>{s.name || "Unnamed Section"}</SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Select disabled={true} value="">
                                    <SelectTrigger disabled className="bg-muted/50 cursor-not-allowed opacity-70">
                                        <SelectValue
                                            placeholder={
                                                !formData.classId
                                                    ? "Select Class first"
                                                    : "No Sections Allowed"
                                            }
                                        />
                                    </SelectTrigger>
                                </Select>
                            )}
                            <FieldError message={fieldErrors.sectionId} />
                            {formData.classId && classAllowsSections && availableSections.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    No sections created for this class.
                                </p>
                            )}
                            {formData.classId && !classAllowsSections && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    This class does not allow sections.
                                </p>
                            )}
                        </div>
                        <div>
                            <Label>Roll Number *</Label>
                            <div className="flex items-center">
                                {calculatedPrefix && (
                                    <div className="bg-muted px-3 py-2 border border-r-0 rounded-l-md text-xs font-mono text-muted-foreground h-10 flex items-center whitespace-nowrap">
                                        {calculatedPrefix}
                                    </div>
                                )}
                                <Input
                                    className={`${calculatedPrefix ? "rounded-l-none" : ""} ${fieldErrors.rollNumber ? "border-destructive" : ""}`}
                                    value={rollNumberSuffix}
                                    onChange={(e) => updateField("rollNumber", `${calculatedPrefix}${e.target.value}`)}
                                    placeholder="e.g. 26-001"
                                />
                            </div>
                            <FieldError message={fieldErrors.rollNumber} />
                        </div>
                        <div>
                            <Label>Father/Guardian *</Label>
                            <Input
                                value={formData.fatherOrguardian}
                                onChange={(e) => updateField("fatherOrguardian", e.target.value)}
                                placeholder="Father's name"
                                className={fieldErrors.fatherOrguardian ? "border-destructive" : ""}
                            />
                            <FieldError message={fieldErrors.fatherOrguardian} />
                        </div>

                        {/* Parent Info & Demo */}
                        <div>
                            <Label>Parent Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input type="email" value={formData.parentOrGuardianEmail} onChange={e => updateField("parentOrGuardianEmail", e.target.value)} className={fieldErrors.parentOrGuardianEmail ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.parentOrGuardianEmail} />
                        </div>
                        <div>
                            <Label>Parent Phone *</Label>
                            <Input autoComplete="off" value={formData.parentOrGuardianPhone} onChange={e => updateField("parentOrGuardianPhone", e.target.value)} className={fieldErrors.parentOrGuardianPhone ? "border-destructive" : ""} placeholder="0300-1234567" />
                            <FieldError message={fieldErrors.parentOrGuardianPhone} />
                        </div>
                        <div>
                            <Label>Parent CNIC <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.parentCNIC} onChange={e => updateField("parentCNIC", formatCnic(e.target.value))} placeholder="e.g. 12345-6789012-3" className={fieldErrors.parentCNIC ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.parentCNIC} />
                        </div>
                        <div>
                            <Label>Student CNIC <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.studentCnic} onChange={e => updateField("studentCnic", formatCnic(e.target.value))} placeholder="e.g. 12345-6789012-3" className={fieldErrors.studentCnic ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.studentCnic} />
                        </div>
                        <div>
                            <Label>Gender *</Label>
                            <Select value={formData.gender} onValueChange={v => updateField("gender", v)}>
                                <SelectTrigger className={fieldErrors.gender ? "border-destructive" : ""}><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <FieldError message={fieldErrors.gender} />
                        </div>
                        <div>
                            <Label>Religion <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input
                                value={formData.religion}
                                onChange={(e) => updateField("religion", e.target.value)}
                                placeholder="e.g. Islam"
                                className={fieldErrors.religion ? "border-destructive" : ""}
                            />
                            <FieldError message={fieldErrors.religion} />
                        </div>
                        <div>
                            <Label>Date of Birth *</Label>
                            <Input type="date" value={formData.dob} onChange={e => updateField("dob", e.target.value)} className={fieldErrors.dob ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.dob} />
                        </div>
                        <div>
                            <Label>Admission Date *</Label>
                            <Input type="date" value={formData.admissionDate} onChange={e => updateField("admissionDate", e.target.value)} className={fieldErrors.admissionDate ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.admissionDate} />
                        </div>
                        <div className="col-span-1">
                            <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.address} onChange={e => updateField("address", e.target.value)} placeholder="Full address" className={fieldErrors.address ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.address} />
                        </div>

                        {/* Previous Academic Info */}
                        <div>
                            <Label>Admission Form # <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.admissionFormNumber} onChange={e => updateField("admissionFormNumber", e.target.value)} placeholder="e.g. AF-2025-001" />
                        </div>
                        <div>
                            <Label>Previous Board Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.previousBoardName} onChange={e => updateField("previousBoardName", e.target.value)} placeholder="e.g. BISE Peshawar" className={fieldErrors.previousBoardName ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.previousBoardName} />
                        </div>
                        <div>
                            <Label>Previous Board Roll # <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <Input value={formData.previousBoardRollNumber} onChange={e => updateField("previousBoardRollNumber", e.target.value)} placeholder="e.g. 123456" className={fieldErrors.previousBoardRollNumber ? "border-destructive" : ""} />
                            <FieldError message={fieldErrors.previousBoardRollNumber} />
                        </div>
                        <div>
                            <Label>Obtained Marks <span className="text-muted-foreground text-xs">(optional)</span></Label>
                            <div className="flex items-center gap-1">
                                <Input type="number" value={formData.obtainedMarks} onChange={e => updateField("obtainedMarks", e.target.value)} placeholder="e.g. 850" className={fieldErrors.obtainedMarks ? "border-destructive" : ""} />
                                <span className="text-muted-foreground text-sm font-medium px-1">/</span>
                                <Input type="number" value={formData.totalMarks} onChange={e => updateField("totalMarks", e.target.value)} placeholder="e.g. 1100" className={fieldErrors.totalMarks ? "border-destructive" : ""} />
                            </div>
                            <FieldError message={fieldErrors.obtainedMarks || fieldErrors.totalMarks} />
                        </div>
                    </div>
                </div>
            </div>

            {/* FEE INSTALLMENT PLAN SECTION */}
            <div className="mt-4 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-primary">Fee Installment Plan</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddInstallment} className="gap-1">
                        <Plus className="w-4 h-4" /> Add Installment
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tuition Fee (Agreed)</Label>
                            {(currentClassFeeStructure || selectedClass?.feeStructures?.[0]) && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                    Std: Rs. {(currentClassFeeStructure || selectedClass.feeStructures[0]).totalAmount}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                className={`pl-8 font-bold text-primary ${fieldErrors.tuitionFee ? "border-destructive" : ""}`}
                                value={formData.tuitionFee}
                                onChange={e => {
                                    const standardFee = (currentClassFeeStructure || selectedClass?.feeStructures?.[0])?.totalAmount || 0;
                                    let val = e.target.value;

                                    // Restrict agreed amount to be <= standard tution fee
                                    if (standardFee > 0 && Number(val) > standardFee) {
                                        val = standardFee.toString();
                                        toast({
                                            title: "Fee Restricted",
                                            description: `Agreed fee cannot exceed the standard fee of Rs. ${standardFee}`,
                                            variant: "default"
                                        });
                                    }

                                    setFormData(prev => ({
                                        ...prev,
                                        tuitionFee: val,
                                        installments: redistributeInstallments(val, prev.installments)
                                    }));
                                    clearFieldError("tuitionFee");
                                    clearFieldError("installments");
                                }}
                            />
                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">Rs.</span>
                        </div>
                        <FieldError message={fieldErrors.tuitionFee} />
                    </div>
                </div>

                <FieldError message={fieldErrors.installments} />

                {formData.installments.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-4 py-2 text-left">Inst. #</th>
                                    <th className="px-4 py-2 text-left">Amount (Rs.)</th>
                                    <th className="px-4 py-2 text-left">Due Date</th>
                                    <th className="px-4 py-2 text-left">Month</th>
                                    <th className="px-4 py-2 text-left">Session</th>
                                    <th className="px-4 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {formData.installments.map((inst, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2">
                                            <Input
                                                type="number"
                                                className="w-20"
                                                value={inst.installmentNumber}
                                                onChange={e => handleInstallmentChange(index, "installmentNumber", Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={inst.amount}
                                                    onChange={e => handleInstallmentChange(index, "amount", Number(e.target.value))}
                                                    disabled={inst.status === 'PAID'}
                                                    className={inst.status === 'PAID' ? 'bg-muted/50 text-muted-foreground' : ''}
                                                />
                                                {inst.status === 'PAID' && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">PAID</span>}
                                                {inst.status === 'PARTIAL' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">PARTIAL</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                type="date"
                                                value={inst.dueDate ? inst.dueDate.split('T')[0] : ""}
                                                onChange={e => {
                                                    const dateVal = e.target.value;
                                                    const dateObj = new Date(dateVal);
                                                    const monthName = dateObj.toLocaleString('default', { month: 'long' });
                                                    const newInstallments = [...formData.installments];
                                                    newInstallments[index] = {
                                                        ...newInstallments[index],
                                                        dueDate: dateVal,
                                                        month: monthName,
                                                    };
                                                    setFormData({ ...formData, installments: newInstallments });
                                                    clearFieldError("installments");
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Select
                                                value={inst.month || ""}
                                                onValueChange={(month) => handleInstallmentChange(index, "month", month)}
                                            >
                                                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Month" /></SelectTrigger>
                                                <SelectContent>
                                                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => (
                                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <Select
                                                value={selectedSessionName || inst.session || ""}
                                                disabled
                                            >
                                                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Session" /></SelectTrigger>
                                                <SelectContent>
                                                    {academicSessions.map(s => (
                                                        <SelectItem key={s.id} value={s.name}>
                                                            {s.name}{s.isActive ? " (Current)" : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveInstallment(index)} className="text-destructive">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-muted/40">
                                <tr>
                                    <td className="px-4 py-3 font-bold text-sm">Total</td>
                                    <td className="px-4 py-3">
                                        {(() => {
                                            const total = formData.installments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
                                            const agreed = Number(formData.tuitionFee) || 0;
                                            const match = total === agreed;
                                            const exceeded = total > agreed;
                                            return (
                                                <span className={`font-bold text-sm ${
                                                    match ? 'text-green-600' : exceeded ? 'text-red-600' : 'text-amber-600'
                                                }`}>
                                                    Rs. {total.toLocaleString()} / {agreed.toLocaleString()}
                                                    {match && ' ✓'}
                                                    {exceeded && ' (exceeded!)'}
                                                    {!match && !exceeded && ` (Rs. ${(agreed - total).toLocaleString()} remaining)`}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td colSpan={4}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 bg-muted/20 rounded-lg border-2 border-dashed">
                        <p className="text-muted-foreground text-sm italic">No installments defined yet. Default single payment will apply.</p>
                    </div>
                )}
            </div>

            {/* DOCUMENTS */}
            <div className="mt-4 pt-6 border-t">
                <Label className="text-lg font-semibold text-primary mb-4 block">Required Documents</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {[
                        { key: "formB", label: "Form B / Domicile" },
                        { key: "pictures", label: "4 Passport Size Pictures" },
                        { key: "dmcMatric", label: "DMC Matric" },
                        { key: "dmcIntermediate", label: "DMC Intermediate" },
                        { key: "fatherCnic", label: "Father CNIC" },
                        { key: "migration", label: "Migration (if from other board)" },
                        { key: "affidavit", label: "Affidavit" },
                        { key: "admissionForm", label: "Admission Form" },
                    ].map((doc) => (
                        <div
                            key={doc.key}
                            onClick={() => toggleDocument(doc.key)}
                            className={`cursor-pointer rounded-lg border p-3 text-sm font-medium flex items-center justify-center transition-all ${formData.documents?.[doc.key]
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "border-gray-300 hover:bg-gray-100 text-gray-700"
                                }`}
                        >
                            {doc.label}
                            {formData.documents?.[doc.key] && <Check className="w-4 h-4 ml-2" />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={internalSubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditing ? "Update" : "Create"} Student
                </Button>
            </div>
        </div>
    );
};

export default StudentForm;
