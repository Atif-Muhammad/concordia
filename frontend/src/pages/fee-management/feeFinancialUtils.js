import { format } from "date-fns";
import { getDefaultFeeChallanTemplate } from "@/services/api";

const cachedTemplates = {
  INSTALLMENT: null,
  EXTRA: null,
  HOSTEL: null,
};

export const setCachedTemplate = (type, htmlContent) => {
  if (type && htmlContent) {
    cachedTemplates[type] = htmlContent;
  }
};

export const getCachedTemplate = (type) => {
  return cachedTemplates[type] || null;
};

export const loadAndCacheTemplate = async (type = 'INSTALLMENT') => {
  if (cachedTemplates[type]) return cachedTemplates[type];
  try {
    const t = await getDefaultFeeChallanTemplate(type);
    if (t?.htmlContent) {
      cachedTemplates[type] = t.htmlContent;
      return t.htmlContent;
    }
  } catch (e) {
    console.error(`Failed to load template for ${type}:`, e);
  }
  return null;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'PAID':
      return 'bg-success/10 text-success border-success/20';
    case 'PARTIAL':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'OVERDUE':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'VOID':
    case 'SUPERSEDED':
    case 'SETTLED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-amber-100 text-amber-700 border-amber-200';
  }
};

export const getBadgeColor = (prog) => {
  if (!prog?.duration) return 1;
  const match = prog.duration.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

export const getSessionLabelStr = (dateStr, gap = 1) => {
  if (!dateStr) return "";
  const [y, m] = dateStr.split('-').map(Number);
  if (m >= 4) return `${y}-${y + gap}`;
  return `${y - 1}-${y + gap - 1}`;
};

export const getCurrentPaidTime = () => format(new Date(), "HH:mm");

export const buildPaidTimestamp = (dateStr, timeStr) => {
  if (!dateStr) return new Date().toISOString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || getCurrentPaidTime()).split(':').map(Number);
  return new Date(y, m - 1, d, hours || 0, minutes || 0, 0).toISOString();
};

export const safeFormatDate = (dateVal, fmt = "dd MMM yyyy") => {
  if (!dateVal) return "N/A";
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? "N/A" : format(d, fmt);
};

export const format12HourDateTime = (dateVal, timeVal) => {
  if (!dateVal && !timeVal) return "-";
  try {
    const d = dateVal ? new Date(dateVal) : new Date();
    if (isNaN(d.getTime())) return String(timeVal || dateVal || "-");

    if (timeVal && typeof timeVal === "string") {
      const trimmed = timeVal.trim();
      const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
      if (match12) {
        const h = parseInt(match12[1], 10);
        const m = match12[2];
        const ampm = match12[3].toUpperCase();
        return `${format(d, "dd MMM yyyy")}, ${String(h).padStart(2, "0")}:${m} ${ampm}`;
      }
      const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        let h = parseInt(match24[1], 10);
        const m = match24[2];
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${format(d, "dd MMM yyyy")}, ${String(h).padStart(2, "0")}:${m} ${ampm}`;
      }
    }

    return format(d, "dd MMM yyyy, hh:mm a");
  } catch (e) {
    return String(dateVal || "-");
  }
};

export const calculateLateFee = (dueDate, finePerDay) => {
  if (!dueDate || !finePerDay || finePerDay <= 0) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  if (now <= due) return 0;

  const diffTime = Math.abs(now.getTime() - due.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays * finePerDay;
};

export const normalizeChallan = (c) => {
  if (!c || c._normalized) return c;
  const inst = c.installment || {};
  const student = inst.student || c.student || (c.studentId && typeof c.studentId === 'object' ? c.studentId : null);
  const studentId = student?._id?.toString() || student?.id || (typeof c.studentId === 'string' ? c.studentId : c.studentId?.toString());
  const challanNumber = c.challanNumber || c.challanNo || '';
  const challanId = c._id?.toString() || c.id?.toString();
  const studentName = c.studentName || (student ? `${student.fName || ''} ${student.lName || ''}`.trim() : '') || student?.name || '';
  const fatherName = student?.fatherOrguardian || student?.fatherName || c.fatherName || '';
  const rollNumber = student?.rollNumber || student?.admissionNo || c.rollNumber || c.rollNo || '';

  const isExtra = Boolean(
    c.isExtra === true ||
    c.challanType === 'FEE_HEADS_ONLY' ||
    c.type === 'EXTRA' ||
    (!c.installmentNumber && !c.installmentId && !c.installment && ((Array.isArray(c.heads) && c.heads.length > 0) || (Array.isArray(c.challanHeads) && c.challanHeads.length > 0)))
  );

  let basePayable = 0;
  let headsAmount = 0;
  let arrearsAmount = 0;
  const isSettledOrVoid = ['PAID', 'VOID', 'SETTLED'].includes(c.status);
  const existingFine = Number(c.lateFeeAmount ?? c.snapshotLateFee ?? c.lateFeeFine ?? c.fineAmount ?? 0);
  const rateCandidate = Number(c.lateFeeRatePerDay || inst.lateFeeRatePerDay || 0);
  const autoFine = (!isSettledOrVoid && c.dueDate && rateCandidate > 0)
    ? calculateLateFee(c.dueDate, rateCandidate)
    : 0;
  const lateFeeFine = Math.max(existingFine, autoFine);
  const discount = Number(c.discountAmount ?? c.discount ?? 0);
  const advanceAllocations = Array.isArray(c.advanceAllocations) ? c.advanceAllocations : [];
  const allocSum = advanceAllocations.reduce((sum, a) => sum + Number(a.amountApplied ?? a.amount ?? 0), 0);
  const advanceApplied = isExtra ? 0 : Number(
    c.advanceApplied ||
    c.advanceAmount ||
    c.advanceAdjustment ||
    c.appliedAdvance ||
    c.advanceCredit ||
    allocSum ||
    0
  );
  const advanceFromChallanNo = c.advanceFromChallanNo || advanceAllocations.map(a => a.sourceChallanNo).filter(Boolean).join(', ') || '';
  const advanceFromMonth = c.advanceFromMonth || advanceAllocations[0]?.sourceMonth || '';
  const advanceFromChallanId = c.advanceFromChallanId || advanceAllocations[0]?.sourceChallanId || null;
  const excessCreditGenerated = Number(c.excessCreditGenerated ?? 0);
  const creditRemaining = Number(c.creditRemaining ?? 0);
  const creditAdjustedTo = Array.isArray(c.creditAdjustedTo) ? c.creditAdjustedTo : [];

  if (isExtra) {
    basePayable = 0;
    if (Array.isArray(c.heads) && c.heads.length > 0) {
      headsAmount = c.heads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
    } else if (Array.isArray(c.challanHeads) && c.challanHeads.length > 0) {
      headsAmount = c.challanHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
    } else if (c.headsAmount != null) {
      headsAmount = Number(c.headsAmount);
    } else {
      headsAmount = Number(c.amount || 0);
    }
    if (headsAmount === 0 && Number(c.amount || 0) > 0) {
      headsAmount = Number(c.amount || 0);
    }
    arrearsAmount = 0;
  } else {
    basePayable = Number(c.basePayable ?? c.snapshotBaseAmount ?? c.amount ?? 0);
    headsAmount = Number(c.headsAmount ?? getSelectedHeadsTotal(c));
    let dynamicAllocSum = 0;
    let hasAllocSum = false;
    if (Array.isArray(c.arrearAllocations) && c.arrearAllocations.length > 0) {
      hasAllocSum = true;
      dynamicAllocSum = c.arrearAllocations.reduce((s, a) => {
        const src = a.sourceChallanId;
        if (src && typeof src === 'object') {
          const srcNet = Number(src.netPayable != null ? src.netPayable : (src.totalAmount != null ? src.totalAmount : src.grossAmount || 0));
          const srcPaid = Number(src.paidAmount || 0);
          return s + Math.max(0, srcNet - srcPaid);
        }
        return s + (Number(a.amountCarriedForward) || 0);
      }, 0);
    }
    arrearsAmount = Number(hasAllocSum ? dynamicAllocSum : (c.arrearsAmount ?? getTotalArrears(c)));
  }

  const baseGross = basePayable + headsAmount + arrearsAmount;
  const grossAmount = isExtra
    ? (headsAmount + lateFeeFine)
    : (lateFeeFine > 0 ? (baseGross + lateFeeFine) : Number(c.grossAmount || baseGross));

  const calculatedNet = Math.max(0, grossAmount - discount - advanceApplied);

  const netPayable = isExtra
    ? calculatedNet
    : ((!isSettledOrVoid && c.status !== 'PAID')
        ? calculatedNet
        : ((c.netPayable != null && !isNaN(Number(c.netPayable)) && Number(c.netPayable) > 0)
            ? Number(c.netPayable)
            : (Number(c.totalAmount) || calculatedNet)));

  const directPaidAmount = Number(c.directPaidAmount ?? c.amountReceived ?? c.paidAmount ?? 0);
  const isSettled = c.status === 'SETTLED';
  let settledViaArrearsAmount = Number(c.settledViaArrearsAmount ?? c.settledAmount ?? 0);
  if (isSettled && settledViaArrearsAmount === 0 && directPaidAmount < netPayable) {
    settledViaArrearsAmount = Math.max(0, netPayable - directPaidAmount);
  }
  const totalSettledAmount = Number(c.totalSettledAmount ?? (directPaidAmount + settledViaArrearsAmount));
  const effectivePaidAmount = (isSettled || settledViaArrearsAmount > 0) ? totalSettledAmount : directPaidAmount;
  const remainingAmount = isSettled ? 0 : Math.max(0, netPayable - effectivePaidAmount);
  const settledByChallanNo = c.settledByChallanNo || c.settledByChallanNumber || (c.supersededBy?.challanNumber || c.supersededBy?.challanNo || '');
  const settledByChallanId = c.settledByChallanId || (c.supersededBy?._id || c.supersededBy?.id || null);

  const totalAmount = isExtra
    ? netPayable
    : ((!isSettledOrVoid && c.status !== 'PAID')
        ? netPayable
        : (c.totalAmount != null ? Number(c.totalAmount) : netPayable));

  const headsList = Array.isArray(c.heads) ? c.heads : (Array.isArray(c.challanHeads) ? c.challanHeads : []);
  const challanHeadsList = Array.isArray(c.challanHeads) ? c.challanHeads : (Array.isArray(c.heads) ? c.heads : []);

  return {
    ...c,
    id: challanId,
    challanNumber,
    challanNo: challanNumber,
    _normalized: true,
    student,
    studentId,
    month: c.month ?? inst.month ?? null,
    installmentNumber: isExtra ? 0 : (c.installmentNo ?? inst.installmentNumber ?? c.installmentNumber ?? 0),
    session: c.session ?? (typeof c.sessionId === 'object' ? c.sessionId?.name : null) ?? null,
    dueDate: c.dueDate ?? inst.dueDate ?? null,
    issueDate: c.generatedDate ?? c.issueDate ?? c.createdAt ?? null,
    paidDate: c.paidAt ?? c.paidDate ?? null,
    studentClass: inst.class ?? student?.class ?? c.studentClass ?? student?.classId ?? c.classId ?? null,
    studentProgram: inst.student?.program ?? student?.program ?? c.studentProgram ?? student?.programId ?? null,
    studentSection: inst.student?.section ?? student?.section ?? c.studentSection ?? student?.sectionId ?? null,
    studentName,
    fatherName,
    rollNumber,
    rollNo: rollNumber,
    basePayable,
    amount: isExtra ? headsAmount : basePayable,
    headsAmount,
    arrearsAmount,
    lateFeeFine,
    lateFeeAmount: lateFeeFine,
    fineAmount: lateFeeFine,
    lateFeeRatePerDay: rateCandidate || null,
    grossAmount,
    discountAmount: discount,
    discount,
    advanceApplied,
    advanceFromChallanNo,
    advanceFromMonth,
    advanceFromChallanId,
    advanceAllocations,
    excessCreditGenerated,
    creditRemaining,
    creditAdjustedTo,
    netPayable,
    totalAmount,
    paidAmount: directPaidAmount,
    directPaidAmount,
    settledViaArrearsAmount,
    totalSettledAmount,
    effectivePaidAmount,
    remainingAmount,
    selectedHeads: c.challanHeads ?? c.heads ?? c.selectedHeads ?? null,
    heads: headsList,
    challanHeads: challanHeadsList,
    arrearAllocations: Array.isArray(c.arrearAllocations) ? c.arrearAllocations : [],
    status: c.status === 'SUPERSEDED' ? 'SUPERSEDED' : c.status === 'SETTLED' ? 'SETTLED' : (c.status ?? 'PENDING'),
    coveredInstallments: null,
    challanType: isExtra ? 'FEE_HEADS_ONLY' : 'INSTALLMENT',
    type: isExtra ? 'EXTRA' : (c.type || 'INSTALLMENT'),
    isExtra,
    previousChallans: Array.isArray(c.previousChallans) ? c.previousChallans : [],
    supersedes: Array.isArray(c.supersedes) ? c.supersedes : [],
    supersededBy: c.supersededBy ?? null,
    settledAmount: settledViaArrearsAmount,
    settledByChallanNo,
    settledByChallanNumber: settledByChallanNo,
    settledByChallanId,
    paymentHistory: c.paymentHistory || null,
    feeStructure: null,
  };
};

export const getSelectedHeadsTotal = (challan) => {
  if (!challan) return 0;
  if (challan.challanHeads && Array.isArray(challan.challanHeads) && challan.challanHeads.length > 0) {
    return challan.challanHeads.reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  }
  if (challan.heads && Array.isArray(challan.heads) && challan.heads.length > 0) {
    return challan.heads.reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  }
  if (challan.installment?.heads && Array.isArray(challan.installment.heads) && challan.installment.heads.length > 0) {
    return challan.installment.heads.reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  }
  if (challan.headsAmount != null && !isNaN(Number(challan.headsAmount)) && Number(challan.headsAmount) > 0) {
    return Number(challan.headsAmount);
  }
  try {
    const raw = typeof challan?.selectedHeads === 'string'
      ? JSON.parse(challan.selectedHeads)
      : (challan?.selectedHeads || []);
    if (!Array.isArray(raw)) return 0;
    return raw
      .filter(h => typeof h === 'object' && h !== null && h.isSelected !== false)
      .reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  } catch { return 0; }
};

export const getRecursiveArrears = (challan) => {
  if (!challan || !challan.previousChallans || !Array.isArray(challan.previousChallans) || challan.installmentNumber === 0) return 0;
  return challan.previousChallans.reduce((total, prev) => {
    if (prev.status === 'PAID') return total;
    const prevHeads = getSelectedHeadsTotal(prev);
    const rem = Math.max(0,
      (prev.amount || 0) +
      prevHeads +
      (prev.lateFeeFine || 0) -
      (prev.paidAmount || 0) -
      (prev.settledAmount || 0) -
      (prev.discount || 0)
    );
    return total + rem + getRecursiveArrears(prev);
  }, 0);
};

export const getSupersededArrears = (challan) => {
  if (!challan || !challan.supersedes || !Array.isArray(challan.supersedes)) return 0;
  const prevIds = new Set((challan.previousChallans || []).map(p => p.id));
  return challan.supersedes.reduce((total, prev) => {
    if (prev.status === 'VOID' && !prevIds.has(prev.id)) {
      const grossDue = Math.max(0,
        (prev.amount || 0) +
        getSelectedHeadsTotal(prev) +
        (prev.fineAmount || 0) +
        (prev.lateFeeFine || 0) -
        (prev.discount || 0)
      );
      const paidOrSettled = Math.max(0, (prev.paidAmount || 0) + (prev.settledAmount || 0));
      const remainingDue = Math.max(0, grossDue - paidOrSettled);
      return total + remainingDue + getSupersededArrears(prev);
    }
    return total;
  }, 0);
};

export const getTotalArrears = (challan) => {
  if (!challan) return 0;
  if (challan.arrearsAmount != null && !isNaN(Number(challan.arrearsAmount)) && Number(challan.arrearsAmount) > 0) {
    return Number(challan.arrearsAmount);
  }
  if (Array.isArray(challan.arrearAllocations) && challan.arrearAllocations.length > 0) {
    return challan.arrearAllocations.reduce((sum, a) => sum + (Number(a.amountCarriedForward ?? a.amountSettled ?? a.amount) || 0), 0);
  }
  return getRecursiveArrears(challan) + getSupersededArrears(challan);
};

export const getChallanGrossTotal = (challan) => {
  if (!challan) return 0;
  const isExtra = Boolean(
    challan?.isExtra ||
    challan?.challanType === 'FEE_HEADS_ONLY' ||
    challan?.type === 'EXTRA' ||
    (!challan?.installmentNumber && !challan?.installmentId && !challan?.installment && (Array.isArray(challan?.heads) || Array.isArray(challan?.challanHeads)))
  );
  if (isExtra) {
    const headsTotal = Number(getSelectedHeadsTotal(challan) || challan.headsAmount || challan.amount || 0);
    const lateFine = Number(challan.snapshotLateFee ?? challan.lateFeeAmount ?? challan.lateFeeFine ?? challan.fineAmount ?? 0);
    const extraFine = Number(challan.snapshotExtraFine ?? challan.installment?.extraFine ?? 0);
    return headsTotal + lateFine + extraFine;
  }
  const baseAmount = Number(challan.snapshotBaseAmount ?? challan.basePayable ?? challan.amount ?? 0);
  const headsAmount = Number(getSelectedHeadsTotal(challan) || challan.headsAmount || 0);
  const arrearsAmount = challan.arrearsAmount != null
    ? Number(challan.arrearsAmount)
    : (challan.snapshotArrearsAmount != null
        ? Number(challan.snapshotArrearsAmount)
        : Number(getTotalArrears(challan) || 0));
  const extraFine = Number(challan.snapshotExtraFine ?? challan.installment?.extraFine ?? 0);
  const hasAbsenteeInHeads = (challan.challanHeads || challan.heads || []).some(h => (h?.name || '').toLowerCase().includes('absent'));
  const absentiesFine = hasAbsenteeInHeads
    ? 0
    : Number(challan.absenteeFineAmount ?? challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);
  const lateFeeFine = Number(challan.snapshotLateFee ?? challan.lateFeeAmount ?? challan.lateFeeFine ?? 0);
  const discount = Math.abs(Number(challan.snapshotDiscount ?? challan.discount ?? challan.installment?.discount ?? 0));

  return Math.max(0, baseAmount + headsAmount + arrearsAmount + extraFine + absentiesFine + lateFeeFine - discount);
};

export const getChallanTotal = (challan) => {
  if (!challan) return 0;
  return getChallanGrossTotal(challan);
};

export const getChallanNetPayable = (challan) => {
  if (!challan) return 0;
  const gross = getChallanGrossTotal(challan);
  const advance = Number(challan.advanceApplied || challan.advanceAmount || 0);
  const directPaid = Number(challan.directPaidAmount ?? challan.paidAmount ?? 0);
  return Math.max(0, gross - advance - directPaid);
};

export const formatAmount = (amount) => {
  const num = Number(amount) || 0;
  return Math.round(num).toLocaleString();
};

export const numberToWords = (n) => {
  if (n < 0) return "Negative";
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const convert = (num) => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " and " + convert(num % 100) : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  };
  return convert(n) + " Only";
};

export const getAdvanceSourceChallan = (challan, feeChallans = []) => {
  if (!challan) return null;
  const isAdvancePaidTarget =
    ['PAID', 'PARTIAL'].includes(challan.status) &&
    Number(challan.advanceAmount || 0) > 0 &&
    !!challan.advanceFromChallanNo;
  if (!isAdvancePaidTarget) return null;

  const sourceNo = String(challan.advanceFromChallanNo);
  const candidates = [];

  const instLists = [
    ...(Array.isArray(challan.installment?.student?.feeInstallments) ? challan.installment.student.feeInstallments : []),
    ...(Array.isArray(challan.student?.feeInstallments) ? challan.student.feeInstallments : []),
  ];

  for (const inst of instLists) {
    const list = Array.isArray(inst?.challans) ? inst.challans : [];
    for (const c of list) candidates.push(c);
  }

  if (Array.isArray(feeChallans)) {
    for (const c of feeChallans) candidates.push(c);
  }

  return candidates.find((c) => String(c?.challanNumber || '') === sourceNo) || null;
};

export const getPaidAtText = (challan, feeChallans = []) => {
  const sourceAdvanceChallan = getAdvanceSourceChallan(challan, feeChallans);
  if (sourceAdvanceChallan) {
    const sourceInfo = typeof sourceAdvanceChallan.paymentInfo === 'string'
      ? (() => { try { return JSON.parse(sourceAdvanceChallan.paymentInfo); } catch { return {}; } })()
      : (sourceAdvanceChallan.paymentInfo || {});
    const sourceRawPaidAt =
      sourceInfo?.paidAt ||
      sourceInfo?.paidDate ||
      sourceAdvanceChallan?.paidAt ||
      sourceAdvanceChallan?.paymentDate ||
      sourceAdvanceChallan?.updatedAt;
    if (sourceRawPaidAt) {
      const paidAt = new Date(sourceRawPaidAt);
      if (!Number.isNaN(paidAt.getTime())) {
        return format(paidAt, "dd MMM yyyy hh:mm a");
      }
    }
  }

  const latestPayment = Array.isArray(challan?.payments) && challan.payments.length > 0
    ? [...challan.payments].sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0))[0]
    : null;
  const rawPaidAt = challan?.paidAt || challan?.paidDate || challan?.paymentDate || latestPayment?.paymentDate || latestPayment?.date;
  if (rawPaidAt) {
    const paidAt = new Date(rawPaidAt);
    if (!Number.isNaN(paidAt.getTime())) {
      return format(paidAt, "dd MMM yyyy hh:mm a");
    }
  }

  if (challan?.paymentInfo) {
    try {
      const info = typeof challan.paymentInfo === 'string' ? JSON.parse(challan.paymentInfo) : challan.paymentInfo;
      const infoPaidAt = info.paidAt || info.paidDate || info.paymentDate || info.date;
      if (infoPaidAt) {
        const paidAt = new Date(infoPaidAt);
        if (!Number.isNaN(paidAt.getTime())) {
          return format(paidAt, "dd MMM yyyy hh:mm a");
        }
      }
    } catch(e) {}
  }

  return "";
};

export const getAdvanceTargetMonthInfo = (challan, feeChallans = [], studentInstallments = []) => {
  if (!challan) return "";

  const challanNo = String(challan.challanNumber || challan.challanNo || '');
  const challanId = String(challan.id || challan._id || '');
  const targetChallans = (feeChallans || []).filter(c => {
    if (!c) return false;
    const cId = String(c.id || c._id || '');
    if (cId && challanId && cId === challanId) return false;
    if (challanNo && String(c.advanceFromChallanNo || '') === challanNo) return true;
    if (challanId && String(c.advanceFromChallanId || '') === challanId) return true;
    if (Array.isArray(c.advanceAllocations)) {
      return c.advanceAllocations.some(a =>
        (challanNo && String(a.sourceChallanNo || '') === challanNo) ||
        (challanId && String(a.sourceChallanId || '') === challanId)
      );
    }
    return false;
  });

  if (targetChallans.length > 0) {
    const months = [...new Set(targetChallans.map(c => c.month).filter(Boolean))].join(', ');
    const insts = [...new Set(targetChallans.map(c => c.installmentNumber ?? c.installmentNo).filter(v => v !== undefined && v !== null && v !== ''))].join(', ');
    if (months && insts) return `${months} - Installment ${insts}`;
    if (months) return months;
    if (insts) return `Installment ${insts}`;
  }

  const allInsts = (() => {
    const raw = [
      ...(Array.isArray(challan.installment?.student?.feeInstallments) ? challan.installment.student.feeInstallments : []),
      ...(Array.isArray(challan.student?.feeInstallments) ? challan.student.feeInstallments : []),
      ...(Array.isArray(studentInstallments) ? studentInstallments : [])
    ];
    const seen = new Set();
    return raw.filter(i => {
      if (!i) return false;
      const key = i.id || i._id || i.installmentNumber;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const currentInstNo = Number(challan.installmentNumber ?? challan.installmentNo ?? challan.installment?.installmentNumber ?? 0);
  if (currentInstNo > 0 && allInsts.length > 0) {
    const nextInst = allInsts.find(i => Number(i.installmentNumber) === currentInstNo + 1) ||
                     allInsts.find(i => Number(i.installmentNumber) > currentInstNo);
    if (nextInst) {
      const m = nextInst.month || '';
      const num = nextInst.installmentNumber;
      if (m && num) return `${m} - Installment ${num}`;
      if (m) return m;
      if (num) return `Installment ${num}`;
    }
  }

  const currentMonth = challan.month || challan.installment?.month || '';
  if (currentMonth) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const curIdx = months.findIndex(m => m.toLowerCase() === currentMonth.trim().toLowerCase());
    if (curIdx >= 0) {
      const nextMonthName = months[(curIdx + 1) % 12];
      const nextInstLabel = currentInstNo > 0 ? ` - Installment ${currentInstNo + 1}` : '';
      return `${nextMonthName}${nextInstLabel}`;
    }
  }

  return "";
};

export const getPaidChallanRemarks = (challan, feeChallans = []) => {
  const sourceAdvanceChallan = getAdvanceSourceChallan(challan, feeChallans);
  if (sourceAdvanceChallan) {
    const sourceInfo = typeof sourceAdvanceChallan.paymentInfo === 'string'
      ? (() => { try { return JSON.parse(sourceAdvanceChallan.paymentInfo); } catch { return {}; } })()
      : (sourceAdvanceChallan.paymentInfo || {});
    const sourceRemarks = String(sourceInfo?.remarks || sourceAdvanceChallan?.remarks || '').trim();
    return `Advance adjusted via challan #${sourceAdvanceChallan.challanNumber}${sourceRemarks ? ` — ${sourceRemarks}` : ''}`;
  }

  let latestRemarks = "";
  if (Array.isArray(challan?.payments) && challan.payments.length > 0) {
    const latestPayment = [...challan.payments].sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0))[0];
    latestRemarks = latestPayment?.remarks || "";
  }
  if (!latestRemarks) {
    latestRemarks = challan?.remarks || "";
  }
  if (!latestRemarks && challan?.paymentInfo) {
    try {
      const info = typeof challan.paymentInfo === 'string' ? JSON.parse(challan.paymentInfo) : challan.paymentInfo;
      latestRemarks = info?.remarks || "";
    } catch(e) {}
  }
  if (!latestRemarks && (challan?.status === 'SETTLED' || (challan?.settledViaArrearsAmount || 0) > 0)) {
    const sNo = challan?.settledByChallanNo || challan?.settledByChallanNumber || (challan?.supersededBy?.challanNumber || challan?.supersededBy?.challanNo);
    latestRemarks = sNo ? `Settled via Arrears in Challan #${sNo}` : 'Settled via Arrears';
  }
  const excessCredit = Number(challan?.excessCreditGenerated ?? (Math.max(0, Number(challan?.paidAmount ?? 0) - Number(challan?.totalAmount ?? 0))));
  if (!latestRemarks && excessCredit > 0) {
    const targetInfo = getAdvanceTargetMonthInfo(challan, feeChallans);
    latestRemarks = `Includes PKR ${excessCredit.toLocaleString()} Advance Payment${targetInfo ? ` (${targetInfo})` : ''}`;
  }
  return latestRemarks || '-';
};

export const isGenericPaymentMode = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return [
    'cash',
    'bank',
    'bank account',
    'advance credit',
    'advance',
    'credit',
    'online',
    'cheque',
    'check',
    'easypaisa',
    'jazzcash',
    'other',
    'wallet',
    'pos',
    'system',
    'null',
    'undefined',
    'n/a',
    '-'
  ].includes(s);
};

export const extractPayerName = (challan) => {
  if (!challan) return null;

  // 1. Direct staff / admin / receiver fields
  const candidates = [
    challan.receivedByName,
    typeof challan.receivedBy === 'object' ? challan.receivedBy?.name : null,
    typeof challan.receivedBy === 'string' && !isGenericPaymentMode(challan.receivedBy) ? challan.receivedBy : null,
    challan.recordedByName,
    typeof challan.recordedBy === 'object' ? challan.recordedBy?.name : null,
    typeof challan.recordedBy === 'string' && !isGenericPaymentMode(challan.recordedBy) ? challan.recordedBy : null,
    challan.collectedByName,
    challan.staffName,
    typeof challan.staff === 'object' ? challan.staff?.name : null,
    challan.adminName,
    challan.paidByName,
    challan.payerName,
    challan.userName,
    typeof challan.user === 'object' ? challan.user?.name : null,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && !isGenericPaymentMode(c)) {
      return c.trim();
    }
  }

  // 2. Receipts array or receipt
  const receipts = Array.isArray(challan.receipts)
    ? challan.receipts
    : (challan.receipt ? [challan.receipt] : []);
  for (const r of receipts) {
    const rName = r?.recordedBy?.name || r?.recordedByName || r?.receivedByName || (typeof r?.recordedBy === 'string' && !isGenericPaymentMode(r?.recordedBy) ? r.recordedBy : null);
    if (rName && typeof rName === 'string' && !isGenericPaymentMode(rName)) {
      return rName.trim();
    }
  }

  // 3. Payments array
  if (Array.isArray(challan.payments) && challan.payments.length > 0) {
    const sorted = [...challan.payments].sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0));
    for (const p of sorted) {
      const pName = p?.receivedByName || p?.recordedByName || p?.receivedBy?.name || (typeof p?.receivedBy === 'string' && !isGenericPaymentMode(p?.receivedBy) ? p.receivedBy : null) || p?.paidByName || (!isGenericPaymentMode(p?.paidBy) ? p.paidBy : null) || p?.updatedByName;
      if (pName && typeof pName === 'string' && !isGenericPaymentMode(pName)) {
        return pName.trim();
      }
    }
  }

  // 4. paymentInfo object
  if (challan.paymentInfo) {
    try {
      const info = typeof challan.paymentInfo === 'string' ? JSON.parse(challan.paymentInfo) : challan.paymentInfo;
      const infoName = info?.receivedByName || info?.recordedByName || info?.updatedByName || (!isGenericPaymentMode(info?.paidBy) ? info.paidBy : null);
      if (infoName && typeof infoName === 'string' && !isGenericPaymentMode(infoName)) {
        return infoName.trim();
      }
    } catch (e) {}
  }

  // 5. paidBy (if not generic payment mode)
  if (challan.paidBy && typeof challan.paidBy === 'string' && !isGenericPaymentMode(challan.paidBy)) {
    return challan.paidBy.trim();
  }

  // 6. updatedByName / createdByName
  if (challan.updatedByName && typeof challan.updatedByName === 'string' && !isGenericPaymentMode(challan.updatedByName)) {
    return challan.updatedByName.trim();
  }
  if (challan.createdByName && typeof challan.createdByName === 'string' && !isGenericPaymentMode(challan.createdByName)) {
    return challan.createdByName.trim();
  }

  return null;
};

export const getPaidByText = (challan, feeChallans = []) => {
  // 1. Direct payer / staff / admin name on this challan
  const directName = extractPayerName(challan);
  if (directName) return directName;

  // 2. Advance Source Challan (e.g. November installment paid via excess credit from October challan)
  const sourceAdvanceChallan = getAdvanceSourceChallan(challan, feeChallans);
  if (sourceAdvanceChallan) {
    const fromSource = extractPayerName(sourceAdvanceChallan);
    if (fromSource) return fromSource;
  }

  // 3. Settling Challan (if this challan was settled via arrears into a future challan)
  const settlingNo = challan?.settledByChallanNo || challan?.settledByChallanNumber || (challan?.supersededBy?.challanNo || challan?.supersededBy?.challanNumber);
  const settlingId = challan?.settledByChallanId || (challan?.supersededBy?._id || challan?.supersededBy?.id);
  if (settlingNo || settlingId) {
    const settlingChallan = feeChallans.find(c =>
      (settlingNo && (c?.challanNo === settlingNo || c?.challanNumber === settlingNo)) ||
      (settlingId && (c?.id === settlingId || c?._id === settlingId))
    );
    if (settlingChallan) {
      const fromSettling = extractPayerName(settlingChallan);
      if (fromSettling) return fromSettling;
    }
  }

  // 4. Any related paid challan in feeChallans for the same student that has a staff/admin name
  if (Array.isArray(feeChallans) && feeChallans.length > 0) {
    const sId = challan?.studentId?._id || challan?.studentId || challan?.student?.id;
    if (sId) {
      const siblingChallan = feeChallans.find(c =>
        (c?.studentId?._id === sId || c?.studentId === sId || c?.student?.id === sId) &&
        c !== challan &&
        extractPayerName(c)
      );
      if (siblingChallan) {
        const fromSibling = extractPayerName(siblingChallan);
        if (fromSibling) return fromSibling;
      }
    }
  }

  // 5. Final fallback to Super Admin / Admin
  return "Super Admin";
};

export const isPaidChallanForPrint = (challan) => {
  const alreadyPaid = Number(challan?.paidAmount ?? challan?.amountReceived ?? 0);
  const totalDue = Number(challan?.snapshotTotalDue ?? challan?.totalAmount ?? challan?.amount ?? 0);
  return challan?.status === 'PAID' || challan?.status === 'SETTLED' || challan?.status === 'PARTIAL' || (totalDue > 0 && alreadyPaid >= totalDue);
};

export const getPaidChallanRowsHtml = (challan, feeChallans = []) => {
  const paidRemarksStyle = 'background-color: #dcfce7; color: #000; font-weight: 700; font-size: 10px;';
  const blockBorder = 'border-left: 1px solid #9ca3af; border-right: 1px solid #9ca3af;';
  const topBorder = 'border-top: 1.5px solid #111827;';
  const bottomBorder = 'border-bottom: 1px solid #9ca3af;';
  const labelCellStyle = `${paidRemarksStyle} ${blockBorder}`;
  const valueCellStyle = `${paidRemarksStyle} ${blockBorder} text-align: left;`;

  const paidAtText = getPaidAtText(challan, feeChallans);
  const paidByText = getPaidByText(challan, feeChallans);
  const remarksRaw = String(getPaidChallanRemarks(challan, feeChallans) || '');
  const remarksClean = remarksRaw.replace(/\s+/g, ' ').trim();
  const remarksShort = remarksClean.length > 160 ? `${remarksClean.slice(0, 160)}...` : remarksClean;

  const isPartial = challan?.status === 'PARTIAL';
  const labelPrefix = isPartial ? 'Partial ' : '';
  const fallbackRemarks = '-';

  let rowsHtml = "";
  let isFirst = true;

  if (paidAtText) {
    rowsHtml += `<tr class="paid-at-row">
      <td style="${labelCellStyle} ${isFirst ? topBorder : ''}">${labelPrefix}Paid At</td>
      <td style="${valueCellStyle} ${isFirst ? topBorder : ''}">${paidAtText}</td>
    </tr>`;
    isFirst = false;
  }

  if (paidByText) {
    rowsHtml += `<tr class="paid-by-row">
      <td style="${labelCellStyle} ${isFirst ? topBorder : ''}">${labelPrefix}Paid By</td>
      <td style="${valueCellStyle} ${isFirst ? topBorder : ''}">${paidByText}</td>
    </tr>`;
    isFirst = false;
  }

  rowsHtml += `<tr class="paid-remarks-row">
    <td colspan="2" style="${valueCellStyle} ${bottomBorder} ${isFirst ? topBorder : ''}; white-space: normal; word-break: break-word; line-height: 1.35;">
      Remarks: ${remarksShort || fallbackRemarks}
      ${remarksClean.length > 160 ? '<div style="font-size: 9px; opacity: 0.8; margin-top: 3px;">(truncated for print layout)</div>' : ''}
    </td>
  </tr>`;

  return rowsHtml;
};

export const applyPaidChallanPrintTreatment = (html, challan, feeChallans = []) => {
  if (!html || !isPaidChallanForPrint(challan)) return html;

  const hasPaidRows = html.includes('class="paid-at-row"') || html.includes('class="paid-remarks-row"');
  const paidRowsHtml = getPaidChallanRowsHtml(challan, feeChallans);
  const isFullyPaid = ['PAID', 'SETTLED'].includes(challan.status);

  let nextHtml = hasPaidRows ? html : html.replace(
    /<tr[^>]*>\s*<td[^>]*>\s*Remarks\s*<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<\/tr>/gi,
    paidRowsHtml
  );

  if (!hasPaidRows) {
    nextHtml = nextHtml.replace(
      /<tr[^>]*>\s*<td[^>]*>\s*Late Fee Fine after due date\s*<\/td>\s*<td[^>]*>\s*Rs\.\s*\d+\s*Per\s*Day\s*<\/td>\s*<\/tr>/gi,
      paidRowsHtml
    );
  }

  if (isFullyPaid) {
    const systemGeneratedNote = `
      <div class="paid-system-note" style="padding: 8px 10px 5px 10px; margin-top: 4px; font-size: 8px; line-height: 1.35; color: #475569; font-style: italic;">
        * This paid challan is system generated and does not require bank/account officer or depositor signatures.
      </div>
    `;
    nextHtml = nextHtml.replace(
      /<div class="signatures">[\s\S]*?<div class="sig-label">Depositor Signature<\/div>\s*<\/div>\s*<\/div>/gi,
      systemGeneratedNote
    );
  }

  return nextHtml;
};

export const resolveHeadName = (h, feeHeads = []) => {
  if (!h) return "Fee Head";
  if (typeof h === 'string') {
    const found = feeHeads.find(fh => String(fh.id || fh._id) === String(h));
    if (found?.name) return found.name;
    return h;
  }
  if (typeof h === 'number') {
    const found = feeHeads.find(fh => Number(fh.id || fh._id) === Number(h));
    if (found?.name) return found.name;
    return `Head #${h}`;
  }
  if (typeof h === 'object') {
    if (h.headName && typeof h.headName === 'string' && h.headName.trim() && h.headName.toLowerCase() !== 'additional fee') {
      return h.headName.trim();
    }
    if (h.name && typeof h.name === 'string' && h.name.trim() && h.name.toLowerCase() !== 'additional fee' && h.name !== 'Fee Head') {
      return h.name.trim();
    }
    if (h.feeHead?.name && typeof h.feeHead.name === 'string' && h.feeHead.name.trim()) {
      return h.feeHead.name.trim();
    }
    if (typeof h.headId === 'object' && h.headId?.name) {
      return h.headId.name.trim();
    }
    const hId = h.headId?._id || h.headId || h.id || h._id;
    if (hId && hId !== -1 && hId !== '-1') {
      const found = feeHeads.find(fh => String(fh.id || fh._id) === String(hId));
      if (found?.name) return found.name.trim();
    }
    if (h.title && typeof h.title === 'string' && h.title.trim()) {
      return h.title.trim();
    }
    if (h.category && typeof h.category === 'string') {
      return `${h.category.charAt(0).toUpperCase() + h.category.slice(1)} Fee`;
    }
    if (h.headName && typeof h.headName === 'string' && h.headName.trim()) {
      return h.headName.trim();
    }
    if (h.name && typeof h.name === 'string' && h.name.trim()) {
      return h.name.trim();
    }
  }
  return "Fee Head";
};

export const generateChallanHtml = (rawChallan, manualTemplate = null, options = {}) => {
  if (!rawChallan) return "";

  const challan = normalizeChallan(rawChallan);

  const {
    challanTemplates = [],
    classes = [],
    programs = [],
    feeHeads = [],
    studentInstallments = [],
    feeChallans = [],
    academicSessions = [],
    extraChallanLateFee = 0,
    lateFeeRatePerDay = 0,
  } = options;

  const student = challan.student || (challan.studentId && typeof challan.studentId === 'object' ? challan.studentId : null) || challan.installment?.student || {};
  let challanCategoryType = 'INSTALLMENT';
  if (challan.isExtra === true || challan.challanType === 'FEE_HEADS_ONLY' || challan.type === 'EXTRA') {
    challanCategoryType = 'EXTRA';
  } else if (challan.isHostel === true || challan.type === 'HOSTEL') {
    challanCategoryType = 'HOSTEL';
  }

  const templateContent = (typeof manualTemplate === 'string' ? manualTemplate : manualTemplate?.htmlContent) ||
    (typeof options.template === 'string' ? options.template : options.template?.htmlContent) ||
    (typeof options.defaultChallanTemplate === 'string' ? options.defaultChallanTemplate : options.defaultChallanTemplate?.htmlContent) ||
    (() => {
      const found = challanTemplates.find(t => t.type === challanCategoryType && t.isDefault) ||
                    challanTemplates.find(t => t.type === challanCategoryType) ||
                    challanTemplates.find(t => t.isDefault) ||
                    challanTemplates[0];
      return found?.htmlContent;
    })() ||
    cachedTemplates[challanCategoryType];

  if (!templateContent) {
    if (!cachedTemplates[challanCategoryType]) {
      loadAndCacheTemplate(challanCategoryType);
    }
    return `
      <div style="padding:40px; text-align:center; border: 2px dashed #94a3b8; border-radius: 12px; background: #f8fafc; color: #64748b;">
        <h3 style="margin-bottom: 8px; font-weight: 600;">No Template Configured</h3>
        <p>Please configure a template for ${challanCategoryType === 'EXTRA' ? 'Extra Fee Challan' : challanCategoryType === 'HOSTEL' ? 'Hostel Challan' : 'Standard Installment'} in the Templates tab.</p>
      </div>
    `;
  }

  const rawClass = challan.studentClass || student.classId || student.class || challan.classId || challan.class;
  const rawClassName = typeof rawClass === 'object' ? rawClass?.name : (classes.find(c => String(c.id || c._id) === String(rawClass))?.name || (typeof rawClass === 'string' && !/^[0-9a-fA-F]{24}$/.test(rawClass) ? rawClass : null));
  const studentClass = rawClassName || challan.className || "N/A";

  const rawProgram = challan.studentProgram || student.programId || student.program || challan.programId || challan.program;
  const rawProgramName = typeof rawProgram === 'object' ? rawProgram?.name : (programs.find(p => String(p.id || p._id) === String(rawProgram))?.name || (typeof rawProgram === 'string' && !/^[0-9a-fA-F]{24}$/.test(rawProgram) ? rawProgram : null));
  const studentProgram = rawProgramName || challan.programName || "";

  const rawSection = challan.studentSection || student.sectionId || student.section || challan.sectionId || challan.section;
  const rawSectionName = typeof rawSection === 'object' ? rawSection?.name : (typeof rawSection === 'string' && !/^[0-9a-fA-F]{24}$/.test(rawSection) ? rawSection : null);
  const studentSection = rawSectionName || challan.sectionName || "";

  const programClassSection = studentSection
    ? `${studentProgram} / ${studentClass} / ${studentSection}`.replace(/^\/\s*/, '').trim()
    : studentProgram ? `${studentProgram} / ${studentClass}`.replace(/^\/\s*/, '').trim() : studentClass;

  const isExtraChallan = Boolean(
    challan.isExtra === true ||
    challan.challanType === 'FEE_HEADS_ONLY' ||
    challan.type === 'EXTRA' ||
    (!challan.installmentNumber && !challan.installmentId && !challan.installment && ((Array.isArray(challan.heads) && challan.heads.length > 0) || (Array.isArray(challan.challanHeads) && challan.challanHeads.length > 0)))
  );

  const tuitionOnly = isExtraChallan ? 0 : Number(challan.snapshotBaseAmount ?? challan.amount ?? 0);
  const extraFine = Number(challan.installment?.extraFine || 0);
  const hasAbsenteeInHeads = (challan.challanHeads || challan.heads || []).some(h => (h?.name || '').toLowerCase().includes('absent'));
  const absentiesFine = hasAbsenteeInHeads
    ? 0
    : Number(challan.absenteeFineAmount ?? challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? 0);

  const isSettledOrVoid = ['PAID', 'VOID', 'SETTLED'].includes(challan.status);
  const configuredRate = isExtraChallan
    ? (extraChallanLateFee || options.feeSettings?.extraChallanLateFee || 0)
    : (lateFeeRatePerDay || options.feeSettings?.lateFeeRatePerDay || 0);
  const effectiveLateFeeRate = Number(
    (Number(challan.installment?.lateFeeRatePerDay) > 0 ? challan.installment.lateFeeRatePerDay : null) ??
    (Number(challan.lateFeeRatePerDay) > 0 ? challan.lateFeeRatePerDay : null) ??
    (configuredRate || 0)
  );
  const existingFine = Number(
    challan.snapshotLateFee ??
    challan.lateFeeAmount ??
    challan.lateFeeFine ??
    challan.fineAmount ??
    0
  );
  const autoFine = (!isSettledOrVoid && challan.dueDate && effectiveLateFeeRate > 0)
    ? calculateLateFee(challan.dueDate, effectiveLateFeeRate)
    : 0;
  const lateFee = Math.max(existingFine, autoFine);

  const scholarship = Number(challan.snapshotDiscount) || Number(challan.discount) || Number(challan.installment?.discount) || 0;
  const originalArrears = isExtraChallan ? 0 : Number(challan.arrearsAmount ?? challan.snapshotArrearsAmount ?? getTotalArrears(challan) ?? 0);

  let headsSnapshot = [];
  if (Array.isArray(challan.challanHeads) && challan.challanHeads.length > 0) {
    headsSnapshot = challan.challanHeads;
  } else if (Array.isArray(challan.heads) && challan.heads.length > 0) {
    headsSnapshot = challan.heads;
  } else if (challan.installment?.heads && Array.isArray(challan.installment.heads) && challan.installment.heads.length > 0) {
    headsSnapshot = challan.installment.heads;
  } else if (Array.isArray(challan.selectedHeads) && challan.selectedHeads.length > 0) {
    headsSnapshot = challan.selectedHeads;
  } else if (typeof challan.selectedHeads === 'string') {
    try {
      const parsed = JSON.parse(challan.selectedHeads);
      if (Array.isArray(parsed)) headsSnapshot = parsed;
    } catch(e) {}
  }

  const headsSnapshotTotal = headsSnapshot.reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  let headsTotal = 0;
  if (headsSnapshotTotal > 0 || isExtraChallan) {
    headsTotal = headsSnapshotTotal > 0 ? headsSnapshotTotal : Number(challan.amount || 0);
  } else {
    headsTotal = Number(challan.headsAmount || 0);
  }

  const allocSum = Array.isArray(challan.advanceAllocations)
    ? challan.advanceAllocations.reduce((sum, a) => sum + Number(a.amountApplied ?? a.amount ?? 0), 0)
    : 0;
  const appliedAdvance = Number(
    challan.advanceApplied ||
    challan.advanceAmount ||
    challan.advanceAdjustment ||
    challan.appliedAdvance ||
    challan.advanceCredit ||
    challan.installment?.advanceApplied ||
    challan.installment?.advanceAmount ||
    allocSum ||
    0
  );
  let grossTotal = tuitionOnly + headsTotal + lateFee + extraFine + absentiesFine + originalArrears;
  let standardTotal = Math.max(0, grossTotal - Math.abs(scholarship) - appliedAdvance);
  let netPayable = Math.max(0, standardTotal - (challan.paidAmount || 0));

  const headsRowsList = [];
  if (tuitionOnly > 0 && !isExtraChallan) {
    headsRowsList.push(`<tr><td>Tuition Fee</td><td>${tuitionOnly.toLocaleString()}</td></tr>`);
  }
  headsSnapshot.forEach(h => {
    const headName = resolveHeadName(h, feeHeads);
    const amt = Number(h.amount);
    if (amt !== 0) {
      headsRowsList.push(`<tr><td>${headName}</td><td>${amt < 0 ? `- ${Math.abs(amt).toLocaleString()}` : amt.toLocaleString()}</td></tr>`);
    }
  });
  if (lateFee > 0) {
    headsRowsList.push(`<tr><td>Late Fee Fine (Overdue)</td><td>${lateFee.toLocaleString()}</td></tr>`);
  }
  if (extraFine > 0) {
    headsRowsList.push(`<tr><td>Fine (Extra)</td><td>${extraFine.toLocaleString()}</td></tr>`);
  }
  if (absentiesFine > 0) {
    headsRowsList.push(`<tr><td>Fine (Absentees)</td><td>${absentiesFine.toLocaleString()}</td></tr>`);
  }
  if (Math.abs(scholarship) > 0) {
    headsRowsList.push(`<tr><td>Discount</td><td>-${Math.abs(scholarship).toLocaleString()}</td></tr>`);
  }
  const feeHeadsRowsHtml = headsRowsList.join('');

  let arrearsRowsHtml = "";
  const totalArrears = isExtraChallan ? 0 : Number(challan.arrearsAmount ?? challan.snapshotArrearsAmount ?? getTotalArrears(challan) ?? 0);
  if (totalArrears > 0) {
    const allocations = Array.isArray(challan.arrearAllocations) ? challan.arrearAllocations : [];
    const validAllocations = allocations.filter(a => Number(a.amountCarriedForward ?? a.amountSettled ?? a.amount ?? 0) > 0);

    if (validAllocations.length > 0) {
      arrearsRowsHtml = validAllocations.map(alloc => {
        const src = alloc.sourceChallanId;
        const amt = (src && typeof src === 'object')
          ? Math.max(0, Number(src.netPayable != null ? src.netPayable : (src.totalAmount != null ? src.totalAmount : src.grossAmount || 0)) - Number(src.paidAmount || 0))
          : Number(alloc.amountCarriedForward ?? alloc.amountSettled ?? alloc.amount ?? 0);
        const sourceMonth = alloc.sourceMonth || "";
        const sourceInstNo = alloc.sourceInstallmentNumber ?? alloc.installmentNumber ?? alloc.installmentNo;
        const instLabel = sourceInstNo ? `Installment ${sourceInstNo}` : "";
        const sourceChallanNo = alloc.sourceChallanNo || alloc.challanNumber || alloc.challanNo || "";
        const challanLabel = sourceChallanNo ? `Challan #${sourceChallanNo}` : "";
        const rowLabel = sourceMonth
          ? `${sourceMonth}${instLabel ? ` (${instLabel})` : ''}${challanLabel ? ` - ${challanLabel}` : ''}`
          : (challanLabel ? `Arrears from ${challanLabel}` : (instLabel ? `Arrears from ${instLabel}` : "Previous Balance"));

        return `<tr style="background-color: #fafafa; line-height: 1.2;">
          <td style="font-style: italic; font-size: 10px; color: #555;">${rowLabel} (Arrears)</td>
          <td style="font-size: 10px; color: #555; text-align: right;">${amt.toLocaleString()}</td>
        </tr>`;
      }).join('\n');
    } else {
      try {
        const arrearsNums = typeof challan.installment?.arrearsInstallments === 'string'
          ? JSON.parse(challan.installment.arrearsInstallments)
          : (challan.installment?.arrearsInstallments || []);

        if (Array.isArray(arrearsNums) && arrearsNums.length > 0) {
          const allInsts = challan.installment?.student?.feeInstallments || [];
          const prevChallans = Array.isArray(challan.previousChallans) ? challan.previousChallans : [];
          const fallbackPerRow = arrearsNums.length > 0 ? Math.round(totalArrears / arrearsNums.length) : 0;
          arrearsRowsHtml = arrearsNums.map(num => {
            const match = allInsts.find(i => Number(i.installmentNumber) === Number(num));
            const prev = prevChallans.find((p) =>
              Number(p.installmentNo ?? p.installmentNumber ?? p.installment?.installmentNumber ?? -1) === Number(num)
            );
            const prevSettled = Number(prev?.settledAmount ?? 0);
            const prevSnapshotDue = Number(prev?.snapshotTotalDue ?? 0);
            const prevReceived = Number(prev?.amountReceived ?? prev?.paidAmount ?? 0);
            const prevRemainingAtRoll = Math.max(0, prevSnapshotDue - prevReceived);

            const snapArrears = Number(match?.snapshotArrearsAmount ?? 0);
            const settledContribution = Number(match?.settledAmount ?? 0);
            const outstandingPrincipal = Number(match?.outstandingPrincipal ?? 0);
            const matchTotal = Number(match?.totalAmount ?? 0);
            const matchPaid = Number(match?.paidAmount ?? 0);
            const fallbackRemaining = Math.max(0, matchTotal - matchPaid);

            const amt = prevSettled > 0
              ? prevSettled
              : (prevRemainingAtRoll > 0
                ? prevRemainingAtRoll
                : (snapArrears > 0
                  ? snapArrears
                  : (settledContribution > 0
                    ? settledContribution
                    : (outstandingPrincipal > 0 ? outstandingPrincipal : fallbackRemaining))));
            const finalAmt = Number(amt) > 0
              ? Number(amt)
              : (arrearsNums.length === 1 ? totalArrears : fallbackPerRow);
            const sourceMonth = match?.month || "";
            const sourceInstNo = match?.installmentNumber || num;
            const instLabel = sourceInstNo ? `Installment ${sourceInstNo}` : "";
            const sourceChallanNo = prev?.challanNumber || prev?.challanNo || "";
            const challanLabel = sourceChallanNo ? `Challan #${sourceChallanNo}` : "";
            const rowLabel = sourceMonth
              ? `${sourceMonth}${instLabel ? ` (${instLabel})` : ''}${challanLabel ? ` - ${challanLabel}` : ''}`
              : (challanLabel ? `Arrears from ${challanLabel}` : (instLabel ? `Arrears from ${instLabel}` : "Previous Balance"));

            return `<tr style="background-color: #fafafa; line-height: 1.2;">
              <td style="font-style: italic; font-size: 10px; color: #555;">${rowLabel} (Arrears)</td>
              <td style="font-size: 10px; color: #555; text-align: right;">${Number(finalAmt).toLocaleString()}</td>
            </tr>`;
          }).filter(Boolean).join('\n');
        } else if (challan.installment?.arrearsMonths) {
          const months = Array.isArray(challan.installment.arrearsMonths)
            ? challan.installment.arrearsMonths
            : JSON.parse(challan.installment.arrearsMonths);
          arrearsRowsHtml = months.map(m => `
            <tr style="background-color: #fafafa; line-height: 1.2;">
              <td style="font-style: italic; font-size: 10px; color: #555;">${m} (Arrears)</td>
              <td style="font-size: 10px; color: #555; text-align: right;">${Math.round(totalArrears / months.length).toLocaleString()}</td>
            </tr>`).join('\n');
        }
      } catch (e) {}

      if (!arrearsRowsHtml) {
        arrearsRowsHtml = `<tr style="background-color: #fafafa; line-height: 1.2;">
          <td style="font-style: italic; font-size: 10px; color: #555;">Previous Balance (Arrears)</td>
          <td style="font-size: 10px; color: #555; text-align: right;">${totalArrears.toLocaleString()}</td>
        </tr>`;
      }
    }
  }

  let advanceRowsHtml = "";
  if (appliedAdvance > 0) {
    const advAllocations = Array.isArray(challan.advanceAllocations) ? challan.advanceAllocations : [];
    const validAdvAllocations = advAllocations.filter(a => Number(a.amountApplied ?? a.amount ?? 0) > 0);

    const allInsts = (() => {
      const seen = new Set();
      const merged = [
        ...(Array.isArray(challan.installment?.student?.feeInstallments) ? challan.installment.student.feeInstallments : []),
        ...(Array.isArray(challan.student?.feeInstallments) ? challan.student.feeInstallments : []),
        ...(Array.isArray(studentInstallments) ? studentInstallments : []),
      ];
      return merged.filter(inst => {
        if (!inst || !inst.id) return false;
        if (seen.has(inst.id)) return false;
        seen.add(inst.id);
        return true;
      });
    })();

    const resolveSourceInfo = (srcChallanNo, srcMonth, srcInstNo) => {
      let sourceInst = null;
      let sourceChallan = null;
      if (srcChallanNo) {
        for (const inst of allInsts) {
          const found = (inst.challans || []).find(c => String(c.challanNumber || c.challanNo) === String(srcChallanNo));
          if (found) {
            sourceChallan = found;
            sourceInst = inst;
            break;
          }
        }
      }
      const finalMonth = srcMonth || sourceInst?.month || sourceChallan?.installment?.month || sourceChallan?.month || "";
      const finalInstNo = srcInstNo ?? sourceInst?.installmentNumber ?? sourceChallan?.installmentNo ?? sourceChallan?.installmentNumber ?? sourceChallan?.installment?.installmentNumber;
      const instLabel = finalInstNo ? `Installment ${finalInstNo}` : "";
      const challanLabel = srcChallanNo ? `Challan #${srcChallanNo}` : "";

      const labelPrefix = finalMonth
        ? `${finalMonth}${instLabel ? ` (${instLabel})` : ''}${challanLabel ? ` - ${challanLabel}` : ''}`
        : (challanLabel ? challanLabel : (instLabel ? instLabel : ""));
      return labelPrefix ? `${labelPrefix} (Advance Adjustment)` : "Advance Adjustment";
    };

    if (validAdvAllocations.length > 0) {
      advanceRowsHtml = validAdvAllocations.map(alloc => {
        const amt = Number(alloc.amountApplied ?? alloc.amount ?? 0);
        const rowLabel = resolveSourceInfo(
          alloc.sourceChallanNo || alloc.challanNumber || alloc.challanNo || "",
          alloc.sourceMonth || "",
          alloc.sourceInstallmentNumber ?? alloc.installmentNumber ?? alloc.installmentNo
        );
        return `<tr style="background-color: #fafafa; line-height: 1.2;">
          <td style="font-style: italic; font-size: 10px; color: #555;">${rowLabel}</td>
          <td style="font-size: 10px; color: #555; text-align: right;">-${amt.toLocaleString()}</td>
        </tr>`;
      }).join('\n');
    } else {
      const sourceChallanNo = challan.advanceFromChallanNo || (challan.advanceAllocations?.[0]?.sourceChallanNo) || "";
      const sourceMonth = challan.advanceFromMonth || (challan.advanceAllocations?.[0]?.sourceMonth) || "";
      const rowLabel = resolveSourceInfo(sourceChallanNo, sourceMonth, undefined);
      advanceRowsHtml = `<tr style="background-color: #fafafa; line-height: 1.2;">
        <td style="font-style: italic; font-size: 10px; color: #555;">${rowLabel}</td>
        <td style="font-size: 10px; color: #555; text-align: right;">-${appliedAdvance.toLocaleString()}</td>
      </tr>`;
    }
  }

  const arrearsRowsOnly = arrearsRowsHtml;

  const isSettled = challan.status === 'SETTLED';
  const directPaid = Number(challan.directPaidAmount ?? challan.paidAmount ?? 0);
  const isExtraChallanType = challan.challanType === 'FEE_HEADS_ONLY' || challan.isExtra;
  const isInstallmentChallanType = !isExtraChallanType && (challan.challanType === 'INSTALLMENT' || challan.installmentId || challan.installment);
  const isAdvanceAdjustedInstallment = isInstallmentChallanType && appliedAdvance > 0 && !!challan.advanceFromChallanNo;
  const totalSnap = isExtraChallanType
    ? Math.max(Number(challan.snapshotTotalDue ?? 0), Number(challan.totalAmount ?? 0), standardTotal)
    : (isSettledOrVoid
        ? Number(challan.snapshotTotalDue ?? challan.netPayable ?? challan.totalAmount ?? standardTotal)
        : standardTotal);
  const alreadyPaid = isSettled 
    ? Number(challan.totalSettledAmount ?? challan.netPayable ?? challan.totalAmount ?? totalSnap) 
    : directPaid;
  const remainingPayable = isSettled ? 0 : Math.max(0, totalSnap - alreadyPaid);
  const isFullyPaid = isPaidChallanForPrint(challan);

  const challanSession = (typeof challan.session === 'object' ? challan.session?.name : challan.session) ||
    (typeof challan.sessionId === 'object' ? challan.sessionId?.name : null) ||
    challan.installment?.session?.name ||
    (academicSessions || []).find(s => String(s.id || s._id) === String(challan.sessionId || challan.student?.sessionId || student?.sessionId))?.name ||
    "";
  const challanMonth = challan.month || challan.installment?.month || challan.advanceFromMonth || (challan.dueDate ? safeFormatDate(challan.dueDate, "MMMM") : "");
  const challanInstNo = !isExtraChallan ? (challan.installmentNumber ?? challan.installmentNo ?? challan.installment?.installmentNumber ?? "") : "";

  let html = templateContent;
  html = html.replace(/\{\{challanNo\}\}/g, challan.challanNumber || "");
  html = html.replace(/\{\{challanNumber\}\}/g, challan.challanNumber || "");
  html = html.replace(/\{\{issueDate\}\}/g, safeFormatDate(challan.issueDate || challan.generatedDate || challan.createdAt));
  html = html.replace(/\{\{dueDate\}\}/g, safeFormatDate(challan.dueDate));
  const finalStudentName = `${student.fName || ''} ${student.lName || ''}`.trim() || student.name || challan.studentName || challan.name || "";
  const finalFatherName = student.fatherOrguardian || student.fatherName || challan.fatherName || challan.fatherOrguardian || "";
  const finalRollNo = student.rollNumber || student.admissionNo || challan.rollNumber || challan.rollNo || challan.studentId || "";

  html = html.replace(/\{\{studentName\}\}/g, finalStudentName);
  html = html.replace(/\{\{fatherName\}\}/g, finalFatherName);
  html = html.replace(/\{\{class\}\}/g, programClassSection);
  html = html.replace(/\{\{rollNo\}\}/g, finalRollNo);
  html = html.replace(/\{\{studentId\}\}/g, finalRollNo);
  html = html.replace(/\{\{session\}\}/g, challanSession);
  html = html.replace(/\{\{month\}\}/g, challanMonth);
  html = html.replace(/\{\{installmentNo\}\}/g, challanInstNo !== "" ? String(challanInstNo) : "");

  // Clean up any double or dangling dashes in grid-value (e.g. if session is missing, or extra challan)
  html = html.replace(
    /(<div class="grid-value"[^>]*>)([\s\S]*?)(<\/div>)/gi,
    (match, openTag, content, closeTag) => {
      if (content.includes('&mdash;') || content.includes('—')) {
        const parts = content
          .split(/&mdash;|—/)
          .map(s => s.trim())
          .filter(Boolean);
        return `${openTag}${parts.join(' &mdash; ')}${closeTag}`;
      }
      return match;
    }
  );

  html = html.replace(/\{\{Tuition Fee\}\}/g, '');
  html = html.replace(/<tr[^>]*>\s*<td[^>]*>\s*Total Payable after due date\s*<\/td>[\s\S]*?<\/tr>/gi, '');
  html = html.replace(/\{\{feeHeadsRows\}\}/g, feeHeadsRowsHtml);
  if (html.includes('{{advanceRows}}')) {
    html = html.replace(/\{\{arrearsRows\}\}/g, arrearsRowsOnly);
    html = html.replace(/\{\{advanceRows\}\}/g, advanceRowsHtml);
  } else {
    const combinedArrearsAndAdvance = arrearsRowsOnly
      ? (advanceRowsHtml ? `${arrearsRowsOnly}\n${advanceRowsHtml}` : arrearsRowsOnly)
      : (advanceRowsHtml || "");
    html = html.replace(/\{\{arrearsRows\}\}/g, combinedArrearsAndAdvance);
  }
  html = html.replace(/\{\{advanceAdjustmentRows\}\}/g, advanceRowsHtml);
  html = html.replace(/\{\{advance\}\}/g, appliedAdvance > 0 ? `-${appliedAdvance.toLocaleString()}` : '0');
  html = html.replace(/\{\{advanceAdjustment\}\}/g, appliedAdvance > 0 ? `-${appliedAdvance.toLocaleString()}` : '0');

  if (appliedAdvance > 0 && advanceRowsHtml && !html.includes(advanceRowsHtml)) {
    if (/<tr[^>]*>[\s\S]*?Arrears[\s\S]*?<\/tr>/i.test(html)) {
      html = html.replace(/(<tr[^>]*>[\s\S]*?Arrears[\s\S]*?<\/tr>)/i, `$1\n${advanceRowsHtml}`);
    } else {
      html = html.replace(/(<tr[^>]*class=["']total-row["'][\s\S]*?<\/tr>)/i, `${advanceRowsHtml}\n$1`);
    }
  }

  html = html.replace(/\{\{arrears\}\}/g, totalArrears.toLocaleString());
  const slipRate = (Number(challan.installment?.lateFeeRatePerDay) > 0 ? challan.installment.lateFeeRatePerDay : null) ??
    (Number(challan.lateFeeRatePerDay) > 0 ? challan.lateFeeRatePerDay : null) ??
    (configuredRate || 0);
  const displayRate = effectiveLateFeeRate > 0 ? effectiveLateFeeRate : (slipRate || 0);
  html = html.replace(/\{\{lateFeeRatePerDay\}\}/g, displayRate.toString());
  html = html.replace(/\{\{bankName\}\}/g, options.bankName || options.feeSettings?.bankName || "United Bank Limited");
  html = html.replace(/\{\{accountNumber\}\}/g, options.accountNumber || options.feeSettings?.accountNumber || "");
  html = html.replace(/\{\{accountTitle\}\}/g, options.accountTitle || options.feeSettings?.accountTitle || "Concordia College Peshawar");
  html = html.replace(/\{\{discount\}\}/g, '');

  const directInstallmentPayment = isInstallmentChallanType && (alreadyPaid > 0 || ['PAID', 'SETTLED', 'PARTIAL'].includes(challan.status) || appliedAdvance > 0);
  const nonInstallmentPayment = !isInstallmentChallanType && (alreadyPaid > 0 || ['PAID', 'SETTLED', 'PARTIAL'].includes(challan.status));
  const shouldShowBalanceRows = directInstallmentPayment || nonInstallmentPayment;

  const injectPaidRows = (sourceHtml, rowsHtml) => {
    if (!rowsHtml) return sourceHtml.replace(/\{\{paidRow\}\}/g, '');
    if (sourceHtml.includes('{{paidRow}}')) {
      return sourceHtml.replace(/\{\{paidRow\}\}/g, rowsHtml);
    }
    return sourceHtml.replace(/(<tr[^>]*class=["']total-row["'][\s\S]*?<\/tr>)/gi, `${rowsHtml}\n$1`);
  };

  if (shouldShowBalanceRows) {
    const isAdvanceCovered = appliedAdvance > 0 && standardTotal === 0;
    const paidDisplay = isAdvanceCovered
      ? `${appliedAdvance.toLocaleString()} (Advance)`
      : (alreadyPaid > 0 ? `${alreadyPaid.toLocaleString()}` : '0');
    const showTotalRowInPaid = isFullyPaid ? `
      <tr style="font-weight: 700; border-top: 1px solid #cbd5e1; background-color: #f1f5f9; color: #000;">
        <td>Total Amount</td>
        <td>${standardTotal.toLocaleString()}</td>
      </tr>` : '';

    const excessPaid = (!isAdvanceCovered && appliedAdvance === 0) ? Math.max(0, alreadyPaid - standardTotal) : 0;
    const advanceGenerated = Number(challan.excessCreditGenerated || excessPaid || 0);
    const targetMonthInfo = advanceGenerated > 0 ? getAdvanceTargetMonthInfo(challan, feeChallans, studentInstallments) : '';
    const advanceLabel = targetMonthInfo ? `Advance Payment (${targetMonthInfo})` : 'Advance Payment';
    const showAdvanceGeneratedRow = advanceGenerated > 0 ? `
      <tr style="background-color: #f1f5f9; font-size: 11px; font-weight: normal; line-height: 1.2;">
        <td style="font-style: italic; font-size: 10px; color: #555; font-weight: normal;">${advanceLabel}</td>
        <td style="font-size: 10px; text-align: right; color: #555; font-weight: normal;">${advanceGenerated.toLocaleString()}</td>
      </tr>` : '';

    const paidRowHtml = `
      ${showTotalRowInPaid}
      <tr style="color: #000; background-color: #f1f5f9; font-weight: 600; font-size: 11px;">
        <td>Paid Amount</td>
        <td>${paidDisplay}</td>
      </tr>
      ${showAdvanceGeneratedRow}
      ${challan.status !== 'PENDING' ? `
      <tr style="color: #000; background-color: #f1f5f9; font-weight: 700; border-top: 1px solid #cbd5e1;">
        <td>Remaining Balance</td>
        <td>${remainingPayable.toLocaleString()}</td>
      </tr>` : ''}
    `;
    html = injectPaidRows(html, paidRowHtml);
  } else {
    html = html.replace(/\{\{paidRow\}\}/g, '');
  }

  const netPayableStr = netPayable.toLocaleString();
  const netInWords = numberToWords(netPayable);

  html = html.replace(/\{\{totalAmount\}\}/g, standardTotal.toLocaleString());
  html = html.replace(/\{\{netPayable\}\}/g, netPayableStr);
  html = html.replace(/\{\{amountInWords\}\}/g, netInWords);
  html = html.replace(/\{\{totalInWords\}\}/g, `<strong>${netInWords}</strong>`);
  html = html.replace(/\{\{paymentDetailsRow\}\}/g, '');
  const cellStyle = 'background-color: #e0e0e0; font-weight: bold;';

  const isActuallyFullyPaid = ['PAID', 'SETTLED'].includes(challan.status) || (alreadyPaid >= standardTotal && standardTotal > 0);

  if (isFullyPaid) {
    let latestRemarks = challan.remarks || "";
    if (!latestRemarks && challan.paymentInfo) {
      try {
        const info = typeof challan.paymentInfo === 'string' ? JSON.parse(challan.paymentInfo) : challan.paymentInfo;
        latestRemarks = info.remarks || "";
      } catch(e) {}
    }

    if (isActuallyFullyPaid) {
      html = html.replace(/<tr[^>]*>\s*<td[^>]*>\s*Total Payable within due date\s*<\/td>[\s\S]*?<\/tr>/gi, '');
      html = html.replace(/<tr[^>]*>\s*<td[^>]*>\s*Total Payable after due date\s*<\/td>[\s\S]*?<\/tr>/gi, '');
      html = html.replace(/\{\{totalPayable\}\}/g, '');
    } else {
      html = html.replace(/\{\{totalPayable\}\}/g, remainingPayable.toLocaleString());
    }

    html = html.replace(/<tr class="late-fee-row">[\s\S]*?<\/tr>/gi, getPaidChallanRowsHtml({ ...challan, remarks: latestRemarks }, feeChallans));
    html = html.replace(/\{\{lateFee\}\}/g, latestRemarks || (challan.status === 'PARTIAL' ? '-' : '-'));
  } else {
    html = html.replace(
      /<tr class="late-fee-row">[\s\S]*?<\/tr>/gi,
      `<tr class="late-fee-row">
        <td>Late Fee Fine after due date</td>
        <td style="text-align: right;">Rs. ${displayRate} Per Day</td>
      </tr>`
    );
    if (lateFee > 0) {
      html = html.replace(/<td[^>]*>Total Payable within due date<\/td>/gi,
        `<td style="${cellStyle}">Total Payable (Overdue)</td>`);
    } else {
      html = html.replace(/<td[^>]*>Total Payable within due date<\/td>/gi,
        `<td style="${cellStyle}">Total Payable within due date</td>`);
    }
    html = html.replace(/\{\{totalPayable\}\}/g, remainingPayable.toLocaleString());
    html = html.replace(/\{\{lateFee\}\}/g, `Rs. ${displayRate} Per Day`);
  }

  const currentInstNo = Number(challan.installmentNumber || challan.installment?.installmentNumber || challan.installmentNo || 0);
  const targetStudentId = challan.studentId?._id?.toString() || (typeof challan.studentId === 'string' ? challan.studentId : null) || student?._id?.toString() || student?.id;
  const targetRollNo = challan.rollNumber || challan.rollNo || student?.rollNumber;

  let allStudentInsts = Array.isArray(student?.installments) && student.installments.length > 0
    ? student.installments
    : (Array.isArray(student?.feeInstallments) && student.feeInstallments.length > 0
        ? student.feeInstallments
        : (Array.isArray(studentInstallments) && studentInstallments.length > 0
            ? studentInstallments
            : (Array.isArray(challan.installments) && challan.installments.length > 0
                ? challan.installments
                : (Array.isArray(challan.installment?.student?.installments) && challan.installment.student.installments.length > 0
                    ? challan.installment.student.installments
                    : (Array.isArray(challan.installment?.student?.feeInstallments) && challan.installment.student.feeInstallments.length > 0
                        ? challan.installment.student.feeInstallments
                        : (Array.isArray(challan.previousChallans) && challan.previousChallans.length > 0
                            ? challan.previousChallans
                            : (Array.isArray(challan.paymentHistory) && challan.paymentHistory.length > 0
                                ? challan.paymentHistory
                                : [])))))));

  if ((!allStudentInsts || allStudentInsts.length === 0) && Array.isArray(feeChallans) && feeChallans.length > 0) {
    allStudentInsts = feeChallans.filter(c => {
      if (!c) return false;
      const cSid = c.studentId?._id?.toString() || (typeof c.studentId === 'string' ? c.studentId : null) || c.student?._id?.toString() || c.student?.id;
      const cRno = c.rollNumber || c.rollNo || c.student?.rollNumber;
      return (targetStudentId && cSid && String(targetStudentId) === String(cSid)) ||
             (targetRollNo && cRno && String(targetRollNo).toLowerCase() === String(cRno).toLowerCase());
    });
  }

  let paymentHistory = [];
  if (currentInstNo > 1) {
    paymentHistory = allStudentInsts.filter(i => {
      const num = Number(i?.installmentNumber || i?.installmentNo || 0);
      return num > 0 && num < currentInstNo;
    });
  } else if (currentInstNo === 0) {
    const selfId = String(challan.id || challan._id || '');
    const selfNo = String(challan.challanNumber || challan.challanNo || '');
    paymentHistory = allStudentInsts.filter(i => {
      const iId = String(i?.id || i?._id || '');
      const iNo = String(i?.challanNumber || i?.challanNo || '');
      return (!selfId || iId !== selfId) && (!selfNo || iNo !== selfNo);
    });
  }

  const uniqueMap = new Map();
  const unnumbered = [];
  for (const item of paymentHistory) {
    const num = Number(item?.installmentNumber || item?.installmentNo || 0);
    if (num > 0) uniqueMap.set(num, item);
    else unnumbered.push(item);
  }
  const sortedNumbered = Array.from(uniqueMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v);
  const historyList = (sortedNumbered.length > 0 ? sortedNumbered : unnumbered).slice(-4);

  // Exactly 4 columns for payment history table display
  const displayHistory = [...historyList];
  while (displayHistory.length < 4) {
    displayHistory.push(null);
  }

  const histMonths = displayHistory.map(i => {
    if (!i) return '<td>—</td>';
    let m = i.month || '';
    if (!m || !String(m).trim()) {
      const d = i.dueDate || i.paidDate || i.createdAt;
      if (d) {
        try {
          const dt = new Date(d);
          if (!isNaN(dt.getTime())) m = dt.toLocaleString('en-US', { month: 'short' });
        } catch {}
      }
    }
    if (!m || !String(m).trim()) {
      const num = Number(i.installmentNumber || i.installmentNo || 0);
      m = num > 0 ? `Inst #${num}` : '—';
    }
    return `<td>${m}</td>`;
  }).join('');

  const resolveHistoryItem = (i) => {
    if (!i) return null;
    const instNum = Number(i.installmentNumber || i.installmentNo || 0);
    const instMonth = (i.month || '').trim().toLowerCase();
    const instId = i._id ? String(i._id) : (i.id ? String(i.id) : null);
    const instChallanNo = String(i.challanNumber || i.challanNo || '');

    // 1. If i already is a full challan
    let candidateChallan = (i.challanNo || i.challanNumber || i.grossAmount || i.challanHeads) ? i : null;

    // 2. Check i.challans sub-array if i is installment
    if (!candidateChallan && Array.isArray(i.challans) && i.challans.length > 0) {
      candidateChallan = i.challans.find(c => c && c.status !== 'VOID') || i.challans[0];
    }

    // 3. Pool of all known challans
    const pool = [
      ...(Array.isArray(feeChallans) ? feeChallans : []),
      ...(Array.isArray(student?.challans) ? student.challans : []),
      ...(Array.isArray(challan?.previousChallans) ? challan.previousChallans : []),
    ];

    if (pool.length > 0) {
      const found = pool.find(c => {
        if (!c || c.status === 'VOID') return false;
        const cSid = c.studentId?._id?.toString() || (typeof c.studentId === 'string' ? c.studentId : null) || c.student?._id?.toString() || c.student?.id;
        const cRno = c.rollNumber || c.rollNo || c.student?.rollNumber;
        const isStudentMatch = (targetStudentId && cSid && String(targetStudentId) === String(cSid)) ||
                               (targetRollNo && cRno && String(targetRollNo).toLowerCase() === String(cRno).toLowerCase());
        if (!isStudentMatch) return false;

        if (instChallanNo && (String(c.challanNo) === instChallanNo || String(c.challanNumber) === instChallanNo)) return true;
        if (instNum > 0 && Number(c.installmentNumber || c.installmentNo || 0) === instNum) return true;
        if (instId && c.installmentId && String(c.installmentId) === instId) return true;
        if (instMonth && c.month) {
          const cm = c.month.trim().toLowerCase();
          if (cm === instMonth || cm.includes(instMonth) || instMonth.includes(cm)) return true;
        }
        return false;
      });

      if (found) {
        candidateChallan = found;
      }
    }

    // 4. Look up arrearAllocation from current challan (captures previous arrears & originalDueAmount)
    const arrearAlloc = (Array.isArray(challan?.arrearAllocations) ? challan.arrearAllocations : []).find(a => {
      if (instNum > 0 && Number(a.sourceInstallmentNumber || 0) === instNum) return true;
      if (candidateChallan && a.sourceChallanNo && String(a.sourceChallanNo) === String(candidateChallan.challanNo || candidateChallan.challanNumber)) return true;
      if (instMonth && a.sourceMonth) {
        const sm = a.sourceMonth.trim().toLowerCase();
        if (sm === instMonth || sm.includes(instMonth) || instMonth.includes(sm)) return true;
      }
      return false;
    });

    return { candidateChallan, arrearAlloc };
  };

  const histTotals = displayHistory.map(i => {
    if (!i) return '<td>—</td>';
    const { candidateChallan, arrearAlloc } = resolveHistoryItem(i) || {};

    let tot = 0;
    if (candidateChallan) {
      const cBase = Number(candidateChallan.basePayable ?? candidateChallan.amount ?? 0);
      const cHeads = Number(candidateChallan.headsAmount ?? 0);
      const cFine = Number(candidateChallan.lateFeeAmount ?? candidateChallan.fineAmount ?? 0);
      const cDisc = Number(candidateChallan.discountAmount ?? candidateChallan.discount ?? 0);
      const ownGross = cBase + cHeads + cFine - cDisc;
      if (ownGross > 0) {
        tot = ownGross;
      } else {
        const fullTotal = Number(candidateChallan.grossAmount ?? candidateChallan.totalAmount ?? candidateChallan.netPayable ?? 0);
        const cArrears = Number(candidateChallan.arrearsAmount ?? 0);
        tot = Math.max(0, fullTotal - cArrears);
      }
    }

    if (tot === 0) {
      const base = Number(i.basePayable ?? i.amount ?? 0);
      const heads = Number(i.headsAmount ?? 0);
      const fine = Number(i.lateFeeAmount ?? i.fineAmount ?? 0);
      const disc = Number(i.discountAmount ?? i.discount ?? 0);
      const ownGross = base + heads + fine - disc;
      if (ownGross > 0) {
        tot = ownGross;
      } else {
        const fullTotal = Number(i.grossAmount ?? i.totalAmount ?? i.netPayable ?? i.snapshotTotalDue ?? 0);
        const arrears = Number(i.arrearsAmount ?? 0);
        tot = Math.max(0, fullTotal - arrears);
      }
    }

    if (arrearAlloc && (!candidateChallan || Number(candidateChallan.arrearsAmount || 0) === 0)) {
      const allocTotal = Number(arrearAlloc.originalDueAmount || arrearAlloc.amountCarriedForward || 0);
      if (allocTotal > 0) {
        tot = Math.max(tot, allocTotal);
      }
    }

    return `<td>${tot > 0 ? tot.toFixed(0) : '0'}</td>`;
  }).join('');

  const histPaid = displayHistory.map(i => {
    if (!i) return '<td>—</td>';
    const { candidateChallan, arrearAlloc } = resolveHistoryItem(i) || {};

    let itemTotal = 0;
    if (candidateChallan) {
      const cBase = Number(candidateChallan.basePayable ?? candidateChallan.amount ?? 0);
      const cHeads = Number(candidateChallan.headsAmount ?? 0);
      const cFine = Number(candidateChallan.lateFeeAmount ?? candidateChallan.fineAmount ?? 0);
      const cDisc = Number(candidateChallan.discountAmount ?? candidateChallan.discount ?? 0);
      const ownGross = cBase + cHeads + cFine - cDisc;
      itemTotal = ownGross > 0 ? ownGross : Math.max(0, Number(candidateChallan.totalAmount || 0) - Number(candidateChallan.arrearsAmount || 0));
    }
    if (itemTotal === 0) {
      const base = Number(i.basePayable ?? i.amount ?? 0);
      const heads = Number(i.headsAmount ?? 0);
      const fine = Number(i.lateFeeAmount ?? i.fineAmount ?? 0);
      const disc = Number(i.discountAmount ?? i.discount ?? 0);
      const ownGross = base + heads + fine - disc;
      itemTotal = ownGross > 0 ? ownGross : Math.max(0, Number(i.totalAmount ?? i.grossAmount ?? 0) - Number(i.arrearsAmount || 0));
    }
    if (itemTotal === 0 && arrearAlloc) {
      itemTotal = Number(arrearAlloc.originalDueAmount || arrearAlloc.amountCarriedForward || 0);
    }

    const targetObj = candidateChallan || i;
    const directPaid = Number(targetObj.paidAmount ?? targetObj.directPaidAmount ?? targetObj.amountReceived ?? 0);
    const advancePaid = Number(targetObj.advanceApplied ?? targetObj.advanceAmount ?? 0);
    const statusStr = String(targetObj.status || i.status || '').toUpperCase();
    const settledArrears = Number(targetObj.settledViaArrearsAmount ?? targetObj.settledAmount ?? arrearAlloc?.amountSettled ?? 0);

    let paid = directPaid + advancePaid + settledArrears;

    const subChallans = Array.isArray(i.challans) ? i.challans : [];
    if (subChallans.length > 0) {
      const preferred = subChallans.find(c => ['PAID', 'PARTIAL', 'SETTLED', 'SUCCESS'].includes(String(c?.status || '').toUpperCase())) || subChallans[0];
      if (preferred) {
        const pDirect = Number(preferred.amountReceived ?? preferred.paidAmount ?? preferred.directPaidAmount ?? 0);
        const pAdv = Number(preferred.advanceApplied ?? preferred.advanceAmount ?? 0);
        const pSettled = Number(preferred.settledViaArrearsAmount ?? preferred.settledAmount ?? 0);
        const pPaid = pDirect + pAdv + pSettled;
        if (pPaid > 0) {
          paid = Math.max(paid, pPaid);
        }
      }
    }

    if (['PAID', 'SETTLED'].includes(statusStr)) {
      paid = itemTotal > 0 ? itemTotal : (paid > 0 ? paid : 0);
    } else if (itemTotal > 0 && paid > itemTotal) {
      paid = itemTotal;
    }

    return `<td>${paid > 0 ? paid.toFixed(0) : '0'}</td>`;
  }).join('');

  html = html.replace(/\{\{paymentHistoryMonths\}\}/g, histMonths);
  html = html.replace(/\{\{paymentHistoryTotals\}\}/g, histTotals);
  html = html.replace(/\{\{paymentHistoryPaid\}\}/g, histPaid);

  html = html.replace(/<th([^>]*)>\s*Particulars\s*<\/th>/gi, (match, attrs = "") => {
    const compactStyle = "padding:4px 6px;line-height:1.1;";
    if (/style\s*=/i.test(attrs)) {
      return `<th${attrs.replace(/style\s*=\s*["']([^"']*)["']/i, (_m, s) => ` style="${s};${compactStyle}"`)}>Particulars</th>`;
    }
    return `<th${attrs} style="${compactStyle}">Particulars</th>`;
  });

  html = html.replace(/\{\{paidRow\}\}/g, "");
  html = html.replace(/\{\{paymentDetailsRow\}\}/g, "");

  return applyPaidChallanPrintTreatment(html, challan, feeChallans);
};

export const htmlIncludesChallanNumber = (html, challanNumber) => {
  if (!html || !challanNumber) return true;
  return String(html).includes(String(challanNumber));
};

export const toWholePkrAmount = (val) => {
  const num = Number(val) || 0;
  return Math.round(num);
};
