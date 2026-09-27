import { getDefaultFeeChallanTemplate } from "@/services/api";

export const toHostelAmount = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

export const getHostelHeadsTotal = (c) => {
  if (!Array.isArray(c?.heads) || c.heads.length === 0) return 0;
  return c.heads.reduce((sum, h) => sum + toHostelAmount(h.amount), 0);
};

export const getHostelBaseFee = (c) => {
  const headsTotal = getHostelHeadsTotal(c);
  const hostelFee = toHostelAmount(c?.hostelFee);
  if (hostelFee > 0) {
    return hostelFee + headsTotal;
  }
  return headsTotal > 0 ? headsTotal : toHostelAmount(c?.amount || c?.totalAmount);
};

export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

export const parseYearMonth = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { year: val.getFullYear(), month: val.getMonth() + 1 };
  }
  if (typeof val !== 'string') return null;
  const str = val.trim();
  const ymMatch = str.match(/^(\d{4})-(\d{1,2})/);
  if (ymMatch) {
    return { year: parseInt(ymMatch[1], 10), month: parseInt(ymMatch[2], 10) };
  }
  const parts = str.toLowerCase().split(/[\s,/-]+/);
  let year = null;
  let month = null;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num > 1900 && num < 2200) {
      year = num;
    } else {
      const idx = MONTH_NAMES.findIndex((m) => m.startsWith(part) || part.startsWith(m.slice(0, 3)));
      if (idx !== -1) month = idx + 1;
    }
  }
  if (year && month) {
    return { year, month };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return null;
};

export const getPrevYearMonth = (year, month) => {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
};

export const getNextYearMonth = (year, month) => {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
};

export const formatYearMonth = (year, month) => {
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const yearMonthToLabel = (year, month) => {
  const monthName = MONTH_NAMES[month - 1];
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${year}`;
};

export const compareYearMonth = (a, b) => {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
};

export const isSameMonth = (a, b) => {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month;
};

export const addMonths = (year, month, count) => {
  let m = month + count;
  let y = year;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
};

export const validateChallanEligibility = (registration, targetYm, existingChallans = [], numberOfMonths = 1) => {
  if (!registration || !targetYm) {
    return { eligible: false, code: 'INVALID', reason: 'Invalid data', arrearsAmount: 0 };
  }

  const regYm = parseYearMonth(registration.registrationDate || registration.createdAt) || targetYm;
  const regMonthLabel = yearMonthToLabel(regYm.year, regYm.month);
  const targetMonthLabel = yearMonthToLabel(targetYm.year, targetYm.month);

  const nMonths = Math.max(1, parseInt(numberOfMonths || 1, 10) || 1);
  const targetMonthsList = [];
  for (let i = 0; i < nMonths; i++) {
    targetMonthsList.push(addMonths(targetYm.year, targetYm.month, i));
  }

  let periodLabel = targetMonthLabel;
  if (nMonths > 1) {
    const endYm = addMonths(targetYm.year, targetYm.month, nMonths - 1);
    periodLabel = `${targetMonthLabel} - ${yearMonthToLabel(endYm.year, endYm.month)} (${nMonths} Months)`;
  }

  // 1. Check if any month in the target range is already covered
  const activeChallans = (existingChallans || []).filter(
    (c) => c.status !== 'VOID' && c.status !== 'SUPERSEDED'
  );

  for (const c of activeChallans) {
    const cYm = parseYearMonth(c.month);
    if (!cYm) continue;
    const cNum = Math.max(1, parseInt(c.numberOfMonths || 1, 10) || 1);
    for (let j = 0; j < cNum; j++) {
      const cCovered = addMonths(cYm.year, cYm.month, j);
      for (const tm of targetMonthsList) {
        if (cCovered.year === tm.year && cCovered.month === tm.month) {
          const mLabel = yearMonthToLabel(tm.year, tm.month);
          return {
            eligible: false,
            code: 'ALREADY_EXISTS',
            reason: `Month ${mLabel} is already covered by Challan #${c.challanNumber || c.challanNo}`,
            existingChallan: c,
            arrearsAmount: 0,
            targetMonthLabel: periodLabel,
            regMonthLabel,
          };
        }
      }
    }
  }

  // 2. Check if target start month is before registration month
  if (compareYearMonth(targetYm, regYm) < 0) {
    return {
      eligible: false,
      code: 'BEFORE_REGISTRATION',
      reason: `Registered in ${regMonthLabel} · Cannot generate for earlier month`,
      arrearsAmount: 0,
      targetMonthLabel: periodLabel,
      regMonthLabel,
    };
  }

  // 3. If target month is after registration month, previous month must exist
  if (compareYearMonth(targetYm, regYm) > 0) {
    const prevYm = getPrevYearMonth(targetYm.year, targetYm.month);
    const prevMonthLabel = yearMonthToLabel(prevYm.year, prevYm.month);

    let prevChallan = null;
    for (const c of activeChallans) {
      const cYm = parseYearMonth(c.month);
      if (!cYm) continue;
      const cNum = Math.max(1, parseInt(c.numberOfMonths || 1, 10) || 1);
      for (let j = 0; j < cNum; j++) {
        const covered = addMonths(cYm.year, cYm.month, j);
        if (covered.year === prevYm.year && covered.month === prevYm.month) {
          prevChallan = c;
          break;
        }
      }
      if (prevChallan) break;
    }

    if (!prevChallan) {
      return {
        eligible: false,
        code: 'MISSING_PREVIOUS',
        reason: `Missing challan covering ${prevMonthLabel} · Generate ${prevMonthLabel} first`,
        prevMonthLabel,
        arrearsAmount: 0,
        targetMonthLabel: periodLabel,
        regMonthLabel,
      };
    }

    // Previous challan exists: compute arrears
    const prevTotal = getChallanTotal(prevChallan);
    const prevPaid = toHostelAmount(prevChallan.paidAmount);
    const prevBalance = Math.max(0, prevTotal - prevPaid);

    if (prevBalance > 0) {
      return {
        eligible: true,
        code: 'READY',
        reason: `Arrears from ${prevMonthLabel}: PKR ${prevBalance.toLocaleString()} (${prevChallan.status === 'PARTIAL' ? 'Partially Paid' : 'Unpaid'})`,
        arrearsAmount: prevBalance,
        previousChallan: prevChallan,
        prevMonthLabel,
        targetMonthLabel: periodLabel,
        regMonthLabel,
      };
    }

    return {
      eligible: true,
      code: 'READY',
      reason: `Previous period (${prevMonthLabel}) fully paid · No arrears`,
      arrearsAmount: 0,
      previousChallan: prevChallan,
      prevMonthLabel,
      targetMonthLabel: periodLabel,
      regMonthLabel,
    };
  }

  // 4. Exactly the registration month (first month)
  return {
    eligible: true,
    code: 'READY',
    reason: 'First month of registration · No previous challan',
    arrearsAmount: 0,
    previousChallan: null,
    targetMonthLabel: periodLabel,
    regMonthLabel,
  };
};

export const numberToWords = (n) => {
  if (!n || n === 0) return "Zero Only";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (num) => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " "+ones[num%10] : "");
    if (num < 1000) return ones[Math.floor(num/100)]+" Hundred"+(num%100 ? " and "+convert(num%100) : "");
    if (num < 100000) return convert(Math.floor(num/1000))+" Thousand"+(num%1000 ? " "+convert(num%1000) : "");
    return convert(Math.floor(num/100000))+" Lakh"+(num%100000 ? " "+convert(num%100000) : "");
  };
  return convert(Math.round(n)) + " Only";
};

export const calculateHostelLateFee = (dueDate, hostelLateFee = 0) => {
  if (!dueDate || !hostelLateFee || hostelLateFee <= 0) return 0;
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  if (now <= due) return 0;
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays * hostelLateFee;
};

export const getEffectiveLateFee = (challan, hostelLateFee = 0) => {
  if ((challan.lateFeeFine || 0) > 0) return challan.lateFeeFine;
  if (challan.status === 'PAID' || challan.status === 'VOID') return 0;
  return calculateHostelLateFee(challan.dueDate, hostelLateFee);
};

export const getChallanTotal = (c) => {
  const gross = getHostelBaseFee(c) + toHostelAmount(c.fineAmount) + toHostelAmount(c.lateFeeFine) + toHostelAmount(c.arrearsAmount) - toHostelAmount(c.discount);
  const adv = toHostelAmount(c.advanceApplied);
  return Math.max(0, gross - adv);
};

export const getChallanBalance = (c) => {
  if (c?.status === 'SETTLED' || c?.status === 'VOID') return 0;
  const directPaid = toHostelAmount(c?.paidAmount);
  const settledArrears = toHostelAmount(c?.settledViaArrearsAmount);
  return Math.max(0, getChallanTotal(c) - directPaid - settledArrears);
};

export const getChallanTotalEffective = (c, hostelLateFee = 0) => {
  const lateFee = getEffectiveLateFee(c, hostelLateFee);
  const gross = getHostelBaseFee(c) + toHostelAmount(c.fineAmount) + lateFee + toHostelAmount(c.arrearsAmount) - toHostelAmount(c.discount);
  const adv = toHostelAmount(c.advanceApplied);
  return Math.max(0, gross - adv);
};

export const getChallanBalanceEffective = (c, hostelLateFee = 0) => {
  if (c?.status === 'SETTLED' || c?.status === 'VOID') return 0;
  const directPaid = toHostelAmount(c?.paidAmount);
  const settledArrears = toHostelAmount(c?.settledViaArrearsAmount);
  return Math.max(0, getChallanTotalEffective(c, hostelLateFee) - directPaid - settledArrears);
};

export const monthValueToLabel = (val) => {
  if (!val) return "";
  const ym = parseYearMonth(val);
  if (!ym) return val;
  return yearMonthToLabel(ym.year, ym.month);
};

export const formatHostelChallanDate = (d) => {
  if (!d) return "N/A";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getLatestHostelPayment = (challan) => {
  if (!Array.isArray(challan?.payments) || challan.payments.length === 0) return null;
  return [...challan.payments].sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0))[0];
};

export const getHostelPaidAtText = (challan) => {
  const latestPayment = getLatestHostelPayment(challan);
  const rawPaidAt = challan?.paidAt || challan?.paidDate || latestPayment?.paymentDate || latestPayment?.date || challan?.supersededBy?.paidDate || challan?.supersededBy?.paidAt;
  if (!rawPaidAt) return "";
  const paidAt = new Date(rawPaidAt);
  return Number.isNaN(paidAt.getTime()) ? "" : formatHostelChallanDate(paidAt);
};

export const getHostelPaidRemarks = (challan) => {
  if (challan?.settledByChallanNo || challan?.status === 'SETTLED') {
    const challanNo = challan?.settledByChallanNo || challan?.supersededBy?.challanNumber || challan?.supersededBy?.challanNo || '';
    const month = challan?.settledByMonth || challan?.supersededBy?.month || '';
    return `SETTLED: Paid via arrears clearance in leading Challan #${challanNo}${month ? ` (${month})` : ''}.`;
  }
  const latestPayment = getLatestHostelPayment(challan);
  return latestPayment?.remarks || challan?.paymentRemarks || challan?.remarks || 'FULLY PAID / SETTLED';
};

export const getHostelPaidRowsHtml = (challan) => {
  const paidRemarksStyle = 'background-color: #dcfce7; color: #14532d; font-weight: bold;';
  const paidAtText = getHostelPaidAtText(challan);
  const walletsList = [];
  if (Array.isArray(challan?.payments) && challan.payments.length > 0) {
    challan.payments.forEach(p => {
      if (p.walletName && !walletsList.includes(p.walletName)) {
        walletsList.push(p.walletName);
      }
    });
  }
  if (walletsList.length === 0 && challan?.walletName) {
    walletsList.push(challan.walletName);
  }
  const depositedAccountText = walletsList.join(', ');

  return `
    ${paidAtText ? `<tr class="paid-at-row"><td style="${paidRemarksStyle}">Paid At</td><td style="${paidRemarksStyle}">${paidAtText}</td></tr>` : ''}
    ${depositedAccountText ? `<tr class="paid-wallet-row"><td style="${paidRemarksStyle}">Deposited To</td><td style="${paidRemarksStyle}">${depositedAccountText}</td></tr>` : ''}
    <tr class="paid-remarks-row">
      <td style="${paidRemarksStyle}; vertical-align: top;">Remarks</td>
      <td style="${paidRemarksStyle}; white-space: normal; text-align: left; line-height: 1.35;">${getHostelPaidRemarks(challan)}</td>
    </tr>
  `;
};

export const getHostelPaidSystemNote = () => `
  <div class="paid-system-note" style="padding: 8px 10px 5px 10px; margin-top: 4px; font-size: 8px; line-height: 1.35; color: #475569; font-style: italic;">
    * This paid challan is system generated and does not require bank/account officer or depositor signatures.
  </div>
`;

export const checkHostelTemplateExists = async () => {
  try {
    const template = await getDefaultFeeChallanTemplate("HOSTEL");
    return !!(template && template.htmlContent && template.htmlContent.trim());
  } catch {
    return false;
  }
};

export const generateHostelChallanHtml = async (challan, reg, hostelLateFee = 0) => {
  let template = null;
  try {
    template = await getDefaultFeeChallanTemplate("HOSTEL");
  } catch {
    template = null;
  }
  const name = reg?.student ? `${reg.student.fName || ''} ${reg.student.lName || ''}`.trim() : (reg?.externalName || challan.hostelRegistration?.externalName || "Student");
  const registrationNo = challan.hostelRegNumber || reg.id;
  const rollNo = reg.student?.rollNumber || registrationNo;
  const guardian = reg.student?.fatherOrguardian || challan.student?.fatherOrguardian || reg.externalGuardianName || "-";
  const effectiveLateFee = getEffectiveLateFee(challan, hostelLateFee);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : "N/A";

  const flattenPrevChain = (c) => {
    const result = [];
    let node = c.previousChallan;
    while (node) {
      result.unshift(node);
      node = node.previousChallan;
    }
    return result;
  };
  const prevChainChallans = flattenPrevChain(challan);

  const arrearsRowsHtml = prevChainChallans.map(pc => {
    const pcTotal = getChallanTotal(pc);
    const pcBalance = Math.max(0, pcTotal - (pc.paidAmount||0));
    return `<tr><td>Arrears - ${pc.month}</td><td>${pcBalance.toLocaleString()}</td></tr>`;
  }).join('');

  const arrearsAmount = toHostelAmount(challan.arrearsAmount);
  const hostelFeeVal = toHostelAmount(challan.hostelFee);
  const baseHostelFee = getHostelBaseFee(challan);

  const feeHeadsRowsHtml = [
    hostelFeeVal > 0 ? `<tr><td>Boarding Fee</td><td>${hostelFeeVal.toLocaleString()}</td></tr>` : (baseHostelFee > 0 && (!challan.heads || challan.heads.length === 0) ? `<tr><td>Boarding Fee</td><td>${baseHostelFee.toLocaleString()}</td></tr>` : ''),
    ...(Array.isArray(challan.heads) && challan.heads.length > 0
      ? challan.heads.map(h => `<tr><td>${h.headName || 'Fee Head'}</td><td>${toHostelAmount(h.amount).toLocaleString()}</td></tr>`)
      : []),
    arrearsAmount > 0 && !arrearsRowsHtml ? `<tr><td>Arrears (Previous Balance)</td><td>${arrearsAmount.toLocaleString()}</td></tr>` : '',
    challan.fineAmount > 0 ? `<tr><td>Fine / Additional</td><td>${toHostelAmount(challan.fineAmount).toLocaleString()}</td></tr>` : '',
    challan.discount > 0 ? `<tr><td>Discount</td><td>- ${toHostelAmount(challan.discount).toLocaleString()}</td></tr>` : '',
    effectiveLateFee > 0 ? `<tr><td>Late Fee (Overdue)</td><td>${effectiveLateFee.toLocaleString()}</td></tr>` : '',
  ].filter(Boolean).join('');

  let advanceRowsHtml = "";
  const appliedAdvance = Number(challan.advanceApplied || challan.advanceAmount || 0);
  if (appliedAdvance > 0) {
    const sourceChallanNo = challan.advanceFromChallanNo || "";
    const sourceMonth = challan.advanceFromMonth || "";
    const challanLabel = sourceChallanNo ? `Challan #${sourceChallanNo}` : "";
    const rowLabel = sourceMonth
      ? `${sourceMonth}${challanLabel ? ` - ${challanLabel}` : ''}`
      : (challanLabel ? `Advance from ${challanLabel}` : "Advance Payment");

    advanceRowsHtml = `<tr style="background-color: #f0f9ff; line-height: 1.2;">
      <td style="font-style: italic; font-size: 10px; color: #0369a1;">${rowLabel} (Advance)</td>
      <td style="font-size: 10px; color: #0369a1;">- ${appliedAdvance.toLocaleString()}</td>
    </tr>`;
  }
  const combinedArrearsAndAdvance = (arrearsRowsHtml || "") + advanceRowsHtml;

  const total = Math.max(0, baseHostelFee + toHostelAmount(challan.fineAmount) + effectiveLateFee + arrearsAmount - toHostelAmount(challan.discount) - appliedAdvance);
  const directPaid = Number(challan.paidAmount || 0);
  const settledArrears = Number(challan.settledViaArrearsAmount || 0);
  const isSettled = challan.status === 'SETTLED' || (challan.supersededBy && (challan.supersededBy.status === 'PAID' || challan.supersededBy.paidAmount > 0));
  const effectiveSettledArrears = settledArrears > 0 ? settledArrears : (isSettled ? Math.max(0, total - directPaid) : 0);
  const totalSettledOrPaid = directPaid + effectiveSettledArrears;
  const balance = isSettled ? 0 : Math.max(0, total - totalSettledOrPaid);
  const settledChallanNo = challan.settledByChallanNo || challan.supersededBy?.challanNumber || challan.supersededBy?.challanNo || '';
  const settledMonth = challan.settledByMonth || challan.supersededBy?.month || '';

  const historyChallans = prevChainChallans.slice(-5);
  const paymentHistoryMonths = historyChallans.map(h => `<td>${h.month}</td>`).join('');
  const paymentHistoryTotals = historyChallans.map(h => {
    const t = (h.hostelFee||0) + (h.fineAmount||0) + (h.lateFeeFine||0) + (h.arrearsAmount||0) - (h.discount||0) - (h.advanceApplied||0);
    return `<td>${Math.max(0, t).toLocaleString()}</td>`;
  }).join('');
  const paymentHistoryPaid = historyChallans.map(h => `<td>${(h.paidAmount||0).toLocaleString()}</td>`).join('');

  const isPaid = challan.status === 'PAID' || isSettled || balance <= 0;
  const isVoid = challan.status === 'VOID';
  const displayPayable = isVoid ? 0 : (isPaid ? 0 : balance);
  const payableFormatted = Math.round(displayPayable).toLocaleString();

  if (!template?.htmlContent) {
    const paidRowHtml = (isPaid || totalSettledOrPaid > 0) ? `
      ${isPaid ? `
      <tr style="font-weight: 700; border-top: 1px solid #cbd5e1; background-color: #f1f5f9; color: #000;">
        <td>Total Amount</td>
        <td>PKR ${total.toLocaleString()}</td>
      </tr>` : ''}
      <tr style="color:#166534;background:#f0fdf4;font-weight:600">
        <td>Paid Amount / Settled</td><td>${totalSettledOrPaid > 0 ? `- PKR ${totalSettledOrPaid.toLocaleString()}${effectiveSettledArrears > 0 ? ` (Settled via #${settledChallanNo})` : ''}` : 'PKR 0'}</td>
      </tr>
      ${!isPaid ? `
      <tr style="font-weight:700">
        <td>Remaining Balance</td><td>PKR ${balance.toLocaleString()}</td>
      </tr>` : ''}` : '';
    const isFullyPaidFallback = isPaid;
    return `<!DOCTYPE html><html><head><title>Boarding Fee Challan</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:20px}.challan{border:2px solid #333;padding:16px;max-width:420px;margin:auto}.header{text-align:center;border-bottom:1px solid #333;padding-bottom:8px;margin-bottom:10px}.header h2{margin:0;font-size:14px}.header p{margin:2px 0;font-size:10px}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:4px 6px}.info td:first-child{font-weight:bold;width:40%}.amounts td{border:1px solid #ccc}.amounts td:last-child{text-align:right;font-weight:bold}.total-row td{background:#f0f0f0;font-weight:bold;border:1px solid #333}.words{font-style:italic;font-size:10px;margin:6px 0;border-top:1px dashed #ccc;padding-top:6px}.status{text-align:center;margin-top:8px;font-size:12px;font-weight:bold;padding:4px;border:1px solid #333}.void{background:#fee2e2;color:#991b1b}.paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}@media print{body{padding:0}}</style>
    </head><body><div class="challan"><div class="header"><h2>BOARDING FEE CHALLAN</h2><p>Concordia College Peshawar</p></div>
    <table class="info"><tr><td>Challan No</td><td>${challan.challanNumber}</td></tr><tr><td>Student</td><td>${name}</td></tr><tr><td>Student Id / Registration Number</td><td>${rollNo}</td></tr><tr><td>Father Name</td><td>${guardian}</td></tr><tr><td>Month</td><td>${challan.month}</td></tr><tr><td>Issue Date</td><td>${formatDate(challan.createdAt)}</td></tr><tr><td>Due Date</td><td>${formatDate(challan.dueDate)}</td></tr></table>
    <table class="amounts">${feeHeadsRowsHtml}${combinedArrearsAndAdvance}${paidRowHtml}${!isFullyPaidFallback ? `<tr class="total-row"><td>Total Payable</td><td>PKR ${balance.toLocaleString()}</td></tr><tr><td>Late Fee Fine after due date</td><td>Rs. ${hostelLateFee || 150}/- per day</td></tr>` : getHostelPaidRowsHtml(challan)}</table>
    <div class="words">In Words: ${numberToWords(isFullyPaidFallback ? Math.round(total) : Math.round(balance))}</div>
    ${isFullyPaidFallback ? getHostelPaidSystemNote() : (challan.remarks ? `<div style="font-size:10px;margin-top:4px"><b>Remarks:</b> ${challan.remarks}</div>` : '')}
    <div class="status ${isPaid ? 'paid' : (challan.status==='VOID' ? 'void' : 'pending')}">${challan.status==='VOID' ? 'SUPERSEDED' : (isSettled ? 'SETTLED' : challan.status)}</div>
    </div></body></html>`;
  }

  const replacements = {
    '{{INSTITUTE_NAME}}': 'Concordia College Peshawar',
    '{{INSTITUTE_ADDRESS}}': '60-C, Near NCS School, University Town Peshawar',
    '{{INSTITUTE_PHONE}}': '091-5619915 | 0332-8581222',
    '{{CHALLAN_TITLE}}': 'Boarding Fee Challan',
    '{{challanNumber}}': challan.challanNumber || challan.challanNo || '',
    '{{CHALLAN_NO}}': challan.challanNumber || challan.challanNo || '',
    '{{challanNo}}': challan.challanNumber || challan.challanNo || '',
    '{{studentName}}': name,
    '{{STUDENT_NAME}}': name,
    '{{fatherName}}': guardian,
    '{{FATHER_NAME}}': guardian,
    '{{rollNumber}}': rollNo,
    '{{rollNo}}': rollNo,
    '{{ROLL_NO}}': rollNo,
    '{{className}}': reg.student?.program?.name || 'Boarding',
    '{{CLASS}}': reg.student?.program?.name || 'Boarding',
    '{{class}}': reg.student?.program?.name || 'Boarding',
    '{{programName}}': 'Boarding',
    '{{PROGRAM}}': 'Boarding',
    '{{program}}': 'Boarding',
    '{{section}}': '',
    '{{SECTION}}': '',
    '{{FULL_CLASS}}': reg.student?.program?.name || 'Boarding',
    '{{issueDate}}': formatDate(challan.createdAt),
    '{{ISSUE_DATE}}': formatDate(new Date()),
    '{{dueDate}}': formatDate(challan.dueDate),
    '{{DUE_DATE}}': formatDate(challan.dueDate),
    '{{VALID_DATE}}': formatDate(challan.dueDate),
    '{{month}}': challan.month || '',
    '{{session}}': '',
    '{{installmentNo}}': `Boarding Fee - ${challan.month || ''}`,
    '{{installmentNumber}}': 'Boarding Fee',
    '{{Tuition Fee}}': '',
    '{{TUITION_ORIGINAL}}': (challan.hostelFee||0).toLocaleString(),
    '{{feeHeadsRows}}': feeHeadsRowsHtml,
    '{{FEE_HEADS_TABLE}}': feeHeadsRowsHtml,
    '{{arrears}}': arrearsAmount > 0 ? arrearsAmount.toLocaleString() : '',
    '{{arrearsRows}}': combinedArrearsAndAdvance,
    '{{discount}}': '',
    '{{SCHOLARSHIP}}': (challan.discount||0).toLocaleString(),
    '{{amount}}': total.toLocaleString(),
    '{{TOTAL_AMOUNT}}': total.toLocaleString(),
    '{{rupeesInWords}}': numberToWords(isPaid ? total : (balance > 0 ? balance : total)),
    '{{AMOUNT_IN_WORDS}}': numberToWords(isPaid ? total : (balance > 0 ? balance : total)),
    '{{paidRow}}': (isPaid || totalSettledOrPaid > 0) ? `
      ${isPaid ? `
      <tr style="font-weight: 700; border-top: 1px solid #cbd5e1; background-color: #f1f5f9; color: #000;">
        <td>Total Amount</td>
        <td>PKR ${total.toLocaleString()}</td>
      </tr>` : ''}
      <tr style="color: #000; background-color: #f1f5f9; font-weight: 600; font-size: 11px;">
        <td>Paid Amount / Settled</td>
        <td>PKR ${totalSettledOrPaid.toLocaleString()}${effectiveSettledArrears > 0 ? ` (Settled via #${settledChallanNo})` : ''}</td>
      </tr>
      ${!isPaid ? `
      <tr style="font-weight: 700; border-top: 1px solid #cbd5e1; background-color: #f1f5f9; color: #000;">
        <td>Remaining Balance</td>
        <td>PKR ${balance.toLocaleString()}</td>
      </tr>` : ''}
    ` : '',
    '{{paymentDetailsRow}}': '',
    '{{paymentHistoryMonths}}': paymentHistoryMonths,
    '{{paymentHistoryTotals}}': paymentHistoryTotals,
    '{{paymentHistoryPaid}}': paymentHistoryPaid,
    '{{totalPaid}}': totalSettledOrPaid.toLocaleString(),
    '{{PAID_AMOUNT}}': totalSettledOrPaid.toLocaleString(),
    '{{paidAmount}}': totalSettledOrPaid.toLocaleString(),
    '{{remaining}}': balance.toLocaleString(),
    '{{REMAINING_AMOUNT}}': balance.toLocaleString(),
    '{{remainingAmount}}': balance.toLocaleString(),
    '{{paidDate}}': challan.paidDate ? formatDate(challan.paidDate) : (isSettled && (challan.supersededBy?.paidDate || challan.supersededBy?.paidAt) ? formatDate(challan.supersededBy.paidDate || challan.supersededBy.paidAt) : 'N/A'),
    '{{paymentRemarks}}': challan.remarks || '',
    '{{fineAmount}}': effectiveLateFee.toLocaleString(),
    '{{FINE_ORIGINAL}}': effectiveLateFee.toLocaleString(),
    '{{ARREARS_ORIGINAL}}': arrearsAmount.toLocaleString(),
    '{{ARREARS_BALANCE}}': arrearsAmount.toLocaleString(),
    '{{lateFeeRatePerDay}}': String(hostelLateFee || challan.lateFeeFine || 150),
    '{{walletName}}': (challan.walletName || (challan.payments?.[0]?.walletName) || ''),
    '{{WALLET_NAME}}': (challan.walletName || (challan.payments?.[0]?.walletName) || ''),
    '{{depositedAccount}}': (challan.walletName || (challan.payments?.[0]?.walletName) || ''),
    '{{DEPOSITED_ACCOUNT}}': (challan.walletName || (challan.payments?.[0]?.walletName) || ''),
    '{{instituteName}}': 'Concordia College Peshawar',
    '{{instituteAddress}}': '60-C, Near NCS School, University Town Peshawar',
  };

  let html = template.htmlContent;
  html = html.replace(/\{\{program\}\}\s*\/\s*\{\{class\}\}\s*\/\s*\{\{section\}\}/g, reg.student?.program?.name || 'Boarding');
  html = html.replace(/\{\{class\}\}\s*\/\s*\{\{section\}\}/g, reg.student?.program?.name || 'Boarding');
  html = html.replace(/Student Id/g, 'Student Id / Registration Number');

  Object.entries(replacements).forEach(([key, value]) => {
    try {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safe = String(value).replace(/\$/g, '$$$$');
      html = html.replace(new RegExp(escaped, 'g'), safe);
    } catch {}
  });

  if (isPaid) {
    html = html.replace(/<tr class="late-fee-row">[\s\S]*?<\/tr>/gi, getHostelPaidRowsHtml(challan));
    html = html.replace(/<tr[^>]*>\s*<td[^>]*>\s*Total Payable within due date\s*<\/td>[\s\S]*?<\/tr>/gi, '');
    html = html.replace(/<tr[^>]*>\s*<td[^>]*>\s*Total Payable after due date\s*<\/td>[\s\S]*?<\/tr>/gi, '');
    html = html.replace(/\{\{totalPayable\}\}/g, '');
    html = html.replace(/\{\{netPayable\}\}/g, '');
    html = html.replace(/\{\{NET_PAYABLE\}\}/g, '');
  } else {
    html = html.replace(/\{\{totalPayable\}\}/g, payableFormatted);
    html = html.replace(/\{\{netPayable\}\}/g, payableFormatted);
    html = html.replace(/\{\{NET_PAYABLE\}\}/g, payableFormatted);
    html = html.replace(/\{\{lateFeeRatePerDay\}\}/g, String(hostelLateFee || challan.lateFeeFine || 150));
  }

  return html;
};
