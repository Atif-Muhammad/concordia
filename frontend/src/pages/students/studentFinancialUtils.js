export const getSelectedHeadsTotal = (challan) => {
  if (!challan) return 0;

  if (challan.challanHeads && Array.isArray(challan.challanHeads) && challan.challanHeads.length > 0) {
    return challan.challanHeads.reduce((sum, h) => sum + Math.max(0, Number(h.amount || 0)), 0);
  }

  if (challan.heads && Array.isArray(challan.heads) && !challan.installmentNumber) {
    return challan.heads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  }

  try {
    const raw = challan?.heads || (typeof challan?.selectedHeads === 'string'
      ? JSON.parse(challan.selectedHeads)
      : (challan?.selectedHeads || []));
    if (!Array.isArray(raw)) return 0;
    return raw
      .filter(h => typeof h === 'object' && h !== null && h.isSelected !== false && (h.type === 'additional' || h.feeHeadId || h.headName))
      .reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
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
  return getRecursiveArrears(challan) + getSupersededArrears(challan);
};

export const getChallanTotal = (challan) => {
  if (challan.snapshotTotalDue != null) return Number(challan.snapshotTotalDue);
  const absentiesFine = Number(challan?.snapshotAbsentiesFine ?? challan?.installment?.absentiesFine ?? 0);
  return (challan.amount || 0) +
    getSelectedHeadsTotal(challan) +
    (challan.lateFeeFine || 0) +
    absentiesFine +
    getTotalArrears(challan);
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

export const normalizeChallan = (c, viewStudent = null) => {
  if (!c || c._normalized) return c;
  const inst = c.installment || {};
  const student = inst.student || c.student || viewStudent || null;
  
  const studentClassId = inst.classId ?? c.studentClassId ?? student?.classId ?? null;
  const studentProgramId = inst.programId ?? c.studentProgramId ?? student?.programId ?? null;

  return {
    ...c,
    _normalized: true,
    student,
    studentId: student?.id ?? c.studentId,
    studentClassId,
    studentProgramId,
    month: inst.month ?? c.month ?? null,
    installmentNumber: c.installmentNo ?? inst.installmentNumber ?? c.installmentNumber ?? 0,
    dueDate: inst.dueDate ?? c.dueDate ?? null,
    issueDate: c.generatedDate ?? c.issueDate ?? null,
    paidDate: c.paidAt ?? c.paidDate ?? null,
    amount: Number(c.snapshotBaseAmount ?? c.amount ?? 0),
    paidAmount: (c.status === 'SUPERSEDED' || c.status === 'SETTLED')
      ? Number(inst.paidAmount ?? c.paidAmount ?? 0)
      : Number(c.amountReceived ?? c.paidAmount ?? 0),
    totalAmount: Number(c.snapshotTotalDue ?? c.totalAmount ?? (c.installmentId ? 0 : c.amount) ?? 0),
    lateFeeFine: Number(c.snapshotLateFee ?? c.lateFeeFine ?? 0),
    arrears: Number(c.snapshotArrearsAmount ?? c.arrears ?? 0),
    extraFine: Number(c.snapshotExtraFine ?? inst.extraFine ?? c.extraFine ?? 0),
    absentiesFine: Number(c.snapshotAbsentiesFine ?? inst.absentiesFine ?? c.absentiesFine ?? 0),
    snapshotTotalAbsenties: Number(c.snapshotTotalAbsenties ?? inst.totalAbsenties ?? 0),
    snapshotTotalLeaves: Number(c.snapshotTotalLeaves ?? inst.totalLeaves ?? 0),
    discount: Number(c.snapshotDiscount ?? c.discount ?? inst.discount ?? 0),
    remainingAmount: Number(c.snapshotTotalDue ?? c.totalAmount ?? (c.installmentId ? 0 : c.amount) ?? 0) - Number(c.amountReceived ?? c.paidAmount ?? 0),
    status: c.status === 'SUPERSEDED' ? 'SUPERSEDED' : c.status === 'SETTLED' ? 'SETTLED' : (c.status ?? 'PENDING'),
    challanType: c.installmentId ? 'INSTALLMENT' : 'FEE_HEADS_ONLY',
    selectedHeads: c.heads || c.selectedHeads,
    challanHeads: Array.isArray(c.challanHeads) ? c.challanHeads : [],
    previousChallans: Array.isArray(c.previousChallans) ? c.previousChallans : [],
    supersedes: Array.isArray(c.supersedes) ? c.supersedes : [],
    supersededBy: c.supersededBy || null,
    settledAmount: Number(c.settledAmount ?? 0),
  };
};

export const generateChallanHtml = (challan, manualTemplate = null, { classesData = [], programData = [], defaultChallanTemplate = null } = {}) => {
  if (!challan || !challan.student) return "";

  const student = challan.student;
  const templateContent = manualTemplate || defaultChallanTemplate?.htmlContent;

  if (!templateContent) {
    return `
      <div style="padding:40px; text-align:center; border: 2px dashed #94a3b8; border-radius: 12px; background: #f8fafc; color: #64748b;">
        <h3 style="margin-bottom: 8px; font-weight: 600;">No Default Template Found</h3>
        <p>Please mark a template as "Default" in the Templates tab to enable preview and printing.</p>
      </div>
    `;
  }

  // Resolve Class/Program context
  const studentClass = challan.studentClass?.name || classesData.find(c => extractId(c) === extractId(student.classId))?.name || student.class?.name || "N/A";
  const studentProgram = challan.studentProgram?.name || programData.find(p => extractId(p) === extractId(student.programId))?.name || student.program?.name || "";
  const fullClass = `${studentProgram} ${studentClass}`.trim();
  const studentSection = challan.studentSection?.name || student.section?.name || student.sectionName || "";
  const classSection = studentSection ? `${studentClass} / ${studentSection}` : studentClass;
  const programClassSection = studentSection
    ? `${studentProgram} / ${studentClass} / ${studentSection}`.replace(/^\/\s*/, '').trim()
    : studentProgram ? `${studentProgram} / ${studentClass}` : studentClass;

  const tuitionOnly = Number(challan.snapshotBaseAmount ?? challan.amount ?? 0);
  const headsTotal = Number(getSelectedHeadsTotal(challan) || challan.fineAmount || 0);
  const extraFine = Number(challan.snapshotExtraFine ?? challan.installment?.extraFine ?? challan.extraFine ?? 0);
  const absentiesFine = Number((challan.snapshotAbsentiesFine ?? challan.installment?.absentiesFine ?? challan.absentiesFine) || 0);
  const lateFee = Number(challan.snapshotLateFee ?? challan.lateFeeFine ?? challan.lateFeeAmount ?? 0);
  const scholarship = Number(challan.snapshotDiscount) || Number(challan.discount) || Number(challan.installment?.discount) || 0;
  const originalArrears = Number(challan.snapshotArrearsAmount ?? getTotalArrears(challan) ?? 0);

  const snapshotTotalDue = Number(challan.snapshotTotalDue ?? challan.totalAmount ?? 0);
  const grossTotal = tuitionOnly + headsTotal + lateFee + extraFine + absentiesFine + originalArrears;
  const standardTotal = snapshotTotalDue > 0 ? snapshotTotalDue : Math.max(0, grossTotal - Math.abs(scholarship));
  const netPayable = Math.max(0, standardTotal - Number(challan.paidAmount || 0));
  const fineTotal = headsTotal + lateFee + extraFine + absentiesFine;

  let remainingPaid = challan.paidAmount || 0;
  const arrearsPaid = Math.min(originalArrears, remainingPaid);
  remainingPaid -= arrearsPaid;
  const tuitionPaid = Math.min(tuitionOnly, remainingPaid);
  remainingPaid -= tuitionPaid;
  const finePaid = Math.min(fineTotal, remainingPaid);

  let headsSnapshot = challan.challanHeads || [];
  if (headsSnapshot.length === 0 && challan.installment?.heads) {
    headsSnapshot = challan.installment.heads.map(h => ({ headName: h.headName || h.name, amount: h.amount }));
  }
  if (headsSnapshot.length === 0 && Array.isArray(challan.heads) && challan.heads.length > 0) {
    headsSnapshot = challan.heads.map(h => ({ headName: h.headName || h.name || h.feeHead?.name || 'Fee', amount: h.amount }));
  }

  const headsRowsList = [];
  headsSnapshot.forEach(h => {
    const headName = h.headName || h.feeHead?.name || "Additional Fee";
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
    headsRowsList.push(`<tr><td>Discount</td><td>- ${Math.abs(scholarship).toLocaleString()}</td></tr>`);
  }
  const feeHeadsRowsHtml = headsRowsList.join('');

  const getHeadsTotal = (c) => {
    try {
      const raw = Array.isArray(c?.challanHeads) && c.challanHeads.length > 0
        ? c.challanHeads
        : (typeof c?.selectedHeads === 'string' ? JSON.parse(c.selectedHeads) : (c?.selectedHeads || []));
      if (!Array.isArray(raw)) return 0;
      return raw
        .filter(h => typeof h === 'object' && h !== null && (h.isSelected !== false))
        .reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
    } catch { return 0; }
  };

  const buildArrearRows = (prevChallans, depth = 0) => {
    const indent = depth > 0 ? `${'&nbsp;'.repeat(depth * 4)}↳ ` : '';
    return prevChallans
      .filter(prev => prev.status !== 'PAID')
      .flatMap(prev => {
        const ownAmount = Math.max(0,
          Number(prev.snapshotBaseAmount ?? prev.amount ?? 0) +
          getHeadsTotal(prev) +
          Number(prev.snapshotLateFee ?? prev.lateFeeFine ?? 0) +
          Number(prev.snapshotExtraFine ?? prev.extraFine ?? 0) +
          Number(prev.snapshotAbsentiesFine ?? prev.absentiesFine ?? 0) -
          Math.abs(Number(prev.snapshotDiscount ?? prev.discount ?? 0))
        );
        const label = `${indent}${prev.session || ''} - Installment ${prev.installmentNumber || ''} (${prev.month || ''}) - Balance`;
        const row = `<tr><td>${label}</td><td>${ownAmount.toLocaleString()}</td></tr>`;
        const childRows = prev.previousChallans?.length
          ? buildArrearRows(prev.previousChallans, depth + 1)
          : [];
        return [row, ...childRows];
      });
  };

  const arrearsDetailRows = buildArrearRows(challan.previousChallans || []).join('');

  const currentInstNo = challan.installmentNumber || challan.installment?.installmentNumber || 0;
  const allStudentInsts = Array.isArray(challan.installment?.student?.feeInstallments)
    ? challan.installment.student.feeInstallments
    : [];
  const paymentHistory = currentInstNo > 0
    ? allStudentInsts
        .filter(i => Number(i.installmentNumber) < currentInstNo)
        .sort((a, b) => Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0))
        .slice(-4)
    : [];

  const paymentHistoryMonths = paymentHistory.map(i => `<td>${i.month || '—'}</td>`).join('');
  const paymentHistoryTotals = paymentHistory.map(i => `<td>${Number(i.snapshotTotalDue ?? i.totalAmount ?? 0).toFixed(0)}</td>`).join('');
  const paymentHistoryPaid = paymentHistory.map(i => {
    const challans = Array.isArray(i?.challans) ? i.challans : [];
    const activeChallans = [...challans]
      .filter(c => !['VOID', 'SUPERSEDED'].includes(String(c?.status || '').toUpperCase()))
      .sort((a, b) => {
        const bt = new Date(b?.paidAt || b?.generatedDate || b?.updatedAt || b?.createdAt || 0).getTime();
        const at = new Date(a?.paidAt || a?.generatedDate || a?.updatedAt || a?.createdAt || 0).getTime();
        return bt - at;
      });
    const preferred = activeChallans.find(c => ['PAID', 'PARTIAL', 'SETTLED', 'SUCCESS'].includes(String(c?.status || '').toUpperCase()))
      || activeChallans[0]
      || null;

    const paidFromPreferredChallan = Number(preferred?.amountReceived ?? preferred?.paidAmount ?? 0);
    const installmentAppliedPaid = Number(i?.paidAmount ?? 0);
    const sourceChallanNo = preferred?.challanNumber;

    const linkedAdvanceToThisChallan = sourceChallanNo
      ? allStudentInsts.reduce((sum, inst) => {
          const instChallans = Array.isArray(inst?.challans) ? inst.challans : [];
          const linked = instChallans.reduce((cSum, ch) => {
            if (!ch) return cSum;
            const fromNo = String(ch.advanceFromChallanNo || '');
            if (!fromNo || fromNo !== String(sourceChallanNo)) return cSum;
            const adv = Number(ch.advanceAmount ?? 0);
            return cSum + (Number.isFinite(adv) && adv > 0 ? adv : 0);
          }, 0);
          return sum + linked;
        }, 0)
      : 0;

    const reconstructedPaid = installmentAppliedPaid + linkedAdvanceToThisChallan;
    const actualPaid = Number.isFinite(paidFromPreferredChallan) && paidFromPreferredChallan > 0
      ? paidFromPreferredChallan
      : reconstructedPaid;

    return `<td>${Math.max(0, actualPaid).toFixed(0)}</td>`;
  }).join('');

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const replacements = {
    '{{INSTITUTE_NAME}}': 'Concordia College Peshawar',
    '{{INSTITUTE_ADDRESS}}': '60-C, Near NCS School, University Town Peshawar',
    '{{INSTITUTE_PHONE}}': '091-5619915 | 0332-8581222',
    '{{CHALLAN_TITLE}}': challan.feeStructure?.title || "Fee Challan",
    '{{challanNumber}}': challan.challanNumber,
    '{{rollNumber}}': student.rollNumber,
    '{{className}}': studentClass,
    '{{programName}}': studentProgram,
    '{{installmentNumber}}': challan.installmentNumber > 0 ? `#${challan.installmentNumber}` : 'Additional',
    '{{amount}}': standardTotal.toLocaleString(),
    '{{fineAmount}}': (fineTotal - finePaid).toLocaleString(),
    '{{netPayable}}': netPayable.toLocaleString(),
    '{{instituteName}}': 'Concordia College Peshawar',
    '{{instituteAddress}}': '60-C, Near NCS School, University Town Peshawar',
    '{{challanNo}}': challan.challanNumber,
    '{{issueDate}}': formatDate(challan.issueDate || challan.createdAt),
    '{{dueDate}}': formatDate(challan.dueDate),
    '{{month}}': challan.month || '',
    '{{session}}': challan.session || '',
    '{{installmentNo}}': challan.installmentNumber > 0 ? `Installment #${challan.installmentNumber}` : 'Additional',
    '{{studentName}}': `${student.fName} ${student.lName || ''}`.trim(),
    '{{fatherName}}': student.fatherOrguardian || '',
    '{{rollNo}}': student.rollNumber,
    '{{class}}': programClassSection,
    '{{section}}': studentSection,
    '{{program}}': studentProgram,
    '{{feeHeadsRows}}': feeHeadsRowsHtml,
    '{{Tuition Fee}}': (() => {
      const hasHeadRows = feeHeadsRowsHtml.trim().length > 0;
      return hasHeadRows ? tuitionOnly.toLocaleString() : (tuitionOnly + headsTotal + lateFee).toLocaleString();
    })(),
    '{{arrears}}': (originalArrears - arrearsPaid).toLocaleString(),
    '{{arrearsRows}}': arrearsDetailRows,
    '{{discount}}': Math.abs(scholarship).toLocaleString(),
    '{{totalPayable}}': (() => {
      if (challan.status === 'VOID' && (challan.settledAmount || 0) > 0) {
        const totalDue = Number(challan.snapshotTotalDue ?? 0) > 0
          ? Number(challan.snapshotTotalDue)
          : Math.max(0, Number(challan.amount || 0) + Number(challan.fineAmount || 0) + Number(challan.lateFeeFine || 0) + Number(challan.extraFine || 0) + Number(challan.absentiesFine || 0) - Math.abs(Number(challan.discount || 0)));
        const remaining = Math.max(0, totalDue - (challan.settledAmount || 0));
        return remaining.toLocaleString();
      }
      return netPayable.toLocaleString();
    })(),
    '{{rupeesInWords}}': numberToWords(netPayable),
    '{{paymentHistoryMonths}}': paymentHistoryMonths,
    '{{paymentHistoryTotals}}': paymentHistoryTotals,
    '{{paymentHistoryPaid}}': paymentHistoryPaid,
    '{{paidRow}}': (challan.paidAmount > 0 || (challan.status === 'VOID' && (challan.settledAmount || 0) > 0)) ? `
      <tr style="background-color: #d4edda;">
        <td style="font-weight: bold;">Paid</td>
        <td>${challan.status === 'VOID' ? (challan.settledAmount || 0).toLocaleString() : (challan.paidAmount || 0).toLocaleString()}</td>
      </tr>
    ` : '',
    '{{totalPaid}}': (challan.paidAmount || 0).toLocaleString(),
    '{{paidDate}}': challan.paidDate ? formatDate(challan.paidDate) : 'N/A',
    '{{paymentRemarks}}': challan.paymentRemarks || challan.remarks || 'Paid cash in accounts office',
    '{{remaining}}': Math.max(0, (snapshotTotalDue > 0 ? snapshotTotalDue : standardTotal) - (challan.paidAmount || 0)).toLocaleString(),
    '{{paymentDetailsRow}}': (challan.status === 'PAID' || (challan.status === 'VOID' && (challan.settledAmount || 0) > 0)) ? `
      <tr style="background-color: #d4edda; border: 2px solid #28a745;">
        <td colspan="2" style="padding: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">Payment Details:</div>
          <div style="font-size: 9px;">
            <strong>Total ${challan.status === 'VOID' ? 'Settled' : 'Paid'}:</strong> Rs. ${challan.status === 'VOID' ? (challan.settledAmount || 0).toLocaleString() : (challan.paidAmount || 0).toLocaleString()} 
            <strong style="margin-left: 10px;">${challan.status === 'VOID' ? 'Settled' : 'Paid'} Date:</strong> ${(() => {
              if (challan.status === 'VOID') {
                return challan.supersededBy?.paidDate ? formatDate(challan.supersededBy.paidDate) : 'N/A';
              }
              return challan.paidDate ? formatDate(challan.paidDate) : 'N/A';
            })()}
          </div>
          <div style="font-size: 9px; margin-top: 2px;">
            <strong>Remaining:</strong> Rs. ${(() => {
              if (challan.status === 'VOID') {
                const totalDue = Number(challan.snapshotTotalDue ?? 0) > 0
                  ? Number(challan.snapshotTotalDue)
                  : Math.max(0, Number(challan.amount || 0) + Number(challan.fineAmount || 0) + Number(challan.lateFeeFine || 0) + Number(challan.extraFine || 0) + Number(challan.absentiesFine || 0) - Math.abs(Number(challan.discount || 0)));
                return Math.max(0, totalDue - (challan.settledAmount || 0)).toLocaleString();
              }
              return Math.max(0, (snapshotTotalDue > 0 ? snapshotTotalDue : standardTotal) - (challan.paidAmount || 0)).toLocaleString();
            })()}
          </div>
          <div style="font-size: 9px; margin-top: 2px; font-style: italic;">
            <strong>Remarks:</strong> ${challan.paymentRemarks || challan.remarks || (challan.status === 'VOID' ? 'Settled via superseding challan' : 'Paid cash in accounts office')}
          </div>
        </td>
      </tr>
    ` : '',
    '{{CHALLAN_NO}}': challan.challanNumber,
    '{{ISSUE_DATE}}': formatDate(new Date()),
    '{{DUE_DATE}}': formatDate(challan.dueDate),
    '{{VALID_DATE}}': formatDate(new Date(new Date(challan.dueDate).setDate(new Date(challan.dueDate).getDate() + 7))),
    '{{STUDENT_NAME}}': `${student.fName} ${student.lName || ''}`.trim(),
    '{{FATHER_NAME}}': student.fatherOrguardian || '',
    '{{ROLL_NO}}': student.rollNumber,
    '{{CLASS}}': studentClass,
    '{{SECTION}}': studentSection,
    '{{PROGRAM}}': studentProgram,
    '{{FULL_CLASS}}': fullClass,
    '{{TOTAL_AMOUNT}}': standardTotal.toLocaleString(),
    '{{SCHOLARSHIP}}': scholarship.toLocaleString(),
    '{{NET_PAYABLE}}': netPayable.toLocaleString(),
    '{{AMOUNT_IN_WORDS}}': numberToWords(netPayable),
    '{{FEE_HEADS_TABLE}}': feeHeadsRowsHtml,
    '{{PAID_AMOUNT}}': (challan.paidAmount || 0).toLocaleString(),
    '{{REMAINING_AMOUNT}}': (challan.remainingAmount || 0).toLocaleString(),
    '{{paidAmount}}': (challan.paidAmount || 0).toLocaleString(),
    '{{remainingAmount}}': (challan.remainingAmount || 0).toLocaleString(),
    '{{TUITION_ORIGINAL}}': tuitionOnly.toLocaleString(),
    '{{TUITION_PAID}}': tuitionPaid.toLocaleString(),
    '{{TUITION_BALANCE}}': (tuitionOnly - tuitionPaid).toLocaleString(),
    '{{ARREARS_ORIGINAL}}': originalArrears.toLocaleString(),
    '{{ARREARS_PAID}}': arrearsPaid.toLocaleString(),
    '{{ARREARS_BALANCE}}': (originalArrears - arrearsPaid).toLocaleString(),
    '{{FINE_ORIGINAL}}': fineTotal.toLocaleString(),
    '{{FINE_PAID}}': finePaid.toLocaleString(),
    '{{FINE_BALANCE}}': (fineTotal - finePaid).toLocaleString(),
  };

  let finalHtml = templateContent;

  finalHtml = finalHtml.replace(/\{\{program\}\}\s*\/\s*\{\{class\}\}\s*\/\s*\{\{section\}\}/g, programClassSection);
  finalHtml = finalHtml.replace(/\{\{class\}\}\s*\/\s*\{\{section\}\}/g, classSection);

  if (!finalHtml.includes('{{FEE_HEADS_TABLE}}') && !finalHtml.includes('{{feeHeadsRows}}')) {
    const tuitionRowRegex = /(<tr>\s*<td[^>]*>(?:Tuition Fee|{{Tuition Fee}})<\/td>)/i;
    if (tuitionRowRegex.test(finalHtml)) {
      finalHtml = finalHtml.replace(tuitionRowRegex, `${feeHeadsRowsHtml}$1`);
    }
  }

  Object.entries(replacements).forEach(([key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeValue = String(value).replace(/\$/g, '$$$$');
    finalHtml = finalHtml.replace(new RegExp(escapedKey, 'g'), safeValue);
  });

  finalHtml = finalHtml.replace(/<th([^>]*)>\s*Particulars\s*<\/th>/gi, (match, attrs = "") => {
    const compactStyle = "padding:4px 6px;line-height:1.1;";
    if (/style\s*=/i.test(attrs)) {
      return `<th${attrs.replace(/style\s*=\s*["']([^"']*)["']/i, (_m, s) => ` style="${s};${compactStyle}"`)}>Particulars</th>`;
    }
    return `<th${attrs} style="${compactStyle}">Particulars</th>`;
  });

  return finalHtml;
};

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

export const getStudentAcademicPath = (student, programData = [], classesData = [], sectionsData = []) => {
  if (!student) return "-";

  const program =
    student.program ||
    (typeof student.programId === "object" ? student.programId : null) ||
    programData.find((p) => extractId(p) === extractId(student.programId)) ||
    classesData.find((c) => extractId(c) === extractId(student.classId))?.program;

  const classObj =
    student.class ||
    (typeof student.classId === "object" ? student.classId : null) ||
    classesData.find((c) => extractId(c) === extractId(student.classId));

  const section =
    student.section ||
    (typeof student.sectionId === "object" ? student.sectionId : null) ||
    classObj?.sections?.find((s) => extractId(s) === extractId(student.sectionId)) ||
    sectionsData.find((s) => extractId(s) === extractId(student.sectionId));

  const parts = [
    program?.name || student.programName,
    classObj?.name || student.className,
    section?.name || student.sectionName,
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "-";
};

