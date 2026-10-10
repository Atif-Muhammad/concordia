import { describe, it, expect } from 'vitest';
import {
  generateChallanHtml,
  resolveHeadName,
  getPaidByText,
  applyPaidChallanPrintTreatment,
} from '../fee-management/feeFinancialUtils';

describe('Challan Print & Preview: Arrears, Head Names, Month/Installment', () => {
  const sampleTemplate = `
    <html>
      <body>
        <div class="grid-value">{{session}} &mdash; {{month}} &mdash; {{installmentNo}}</div>
        <table>
          <tbody>
            {{feeHeadsRows}}
            {{arrearsRows}}
            {{paidRow}}
          </tbody>
        </table>
        <div>Total Arrears: {{arrears}}</div>
      </body>
    </html>
  `;

  it('resolves fee head names properly instead of "Additional Fee"', () => {
    expect(resolveHeadName({ name: 'Allied', amount: 500 })).toBe('Allied');
    expect(resolveHeadName({ headName: 'Exam Fee', amount: 1000 })).toBe('Exam Fee');
    expect(resolveHeadName({ feeHead: { name: 'Library Fee' } })).toBe('Library Fee');
    expect(resolveHeadName({ headId: 'h-101', amount: 300 }, [{ id: 'h-101', name: 'Sports Fee' }])).toBe('Sports Fee');
    expect(resolveHeadName({ category: 'annual' })).toBe('Annual Fee');
  });

  it('renders arrears identical to advance format but with positive amount (no "-")', () => {
    const challan = {
      challanNumber: '82485247',
      month: 'October',
      session: '2026-2027',
      installmentNumber: 2,
      basePayable: 10000,
      amount: 10000,
      arrearsAmount: 2000,
      arrearAllocations: [
        {
          sourceChallanNo: 'CH-529146-3998',
          sourceInstallmentNumber: 1,
          sourceMonth: 'September',
          amountCarriedForward: 2000,
        },
      ],
      challanHeads: [
        { name: 'Allied', amount: 500 },
      ],
      student: {
        fName: 'Ali',
        lName: 'Khan',
      },
    };

    const html = generateChallanHtml(challan, sampleTemplate);

    // Verify arrears row format: sourceMonth (Installment #) - Challan # (Arrears)
    expect(html).toContain('September (Installment 1) - Challan #CH-529146-3998 (Arrears)');
    // Positive amount, no '-'
    expect(html).toContain('>2,000<');
    expect(html).not.toMatch(/>\s*-\s*2,000\s*</);

    // Verify head name is Allied, not 'Additional Fee'
    expect(html).toContain('Allied');
    expect(html).not.toContain('Additional Fee');

    // Verify Month / Installment grid value: 2026-2027 — October — 2
    expect(html).toContain('2026-2027 &mdash; October &mdash; 2');
    expect(html).not.toContain('&mdash; &mdash;');
  });

  it('cleans up dangling dashes when session is omitted or for extra challan', () => {
    const challan = {
      challanNumber: 'CH-EXTRA-001',
      isExtra: true,
      month: 'October',
      heads: [{ name: 'Lab Fee', amount: 1500 }],
      student: { fName: 'Sarah', lName: 'Ahmed' },
    };

    const html = generateChallanHtml(challan, sampleTemplate);
    expect(html).toContain('Lab Fee');
    expect(html).not.toContain('&mdash; &mdash;');
    expect(html).toContain('October');
  });

  it('renders advance adjustment identical to arrears styling with negative sign and right alignment', () => {
    const challan = {
      challanNumber: '82485248',
      month: 'November',
      session: '2026-2027',
      installmentNumber: 3,
      basePayable: 10000,
      amount: 10000,
      advanceApplied: 1500,
      advanceAllocations: [
        {
          sourceChallanNo: 'CH-1002',
          sourceInstallmentNumber: 2,
          sourceMonth: 'October',
          amountApplied: 1500,
        },
      ],
      challanHeads: [
        { name: 'Tuition Fee', amount: 10000 },
      ],
      student: {
        fName: 'Ali',
        lName: 'Khan',
      },
    };

    const html = generateChallanHtml(challan, sampleTemplate);

    // Verify row label contains sourceMonth (Installment #) - Challan # (Advance Adjustment)
    expect(html).toContain('October (Installment 2) - Challan #CH-1002 (Advance Adjustment)');
    // Verify identical styling as arrears: #fafafa, #555, text-align: right
    expect(html).toContain('background-color: #fafafa');
    expect(html).toContain('color: #555');
    expect(html).toContain('text-align: right;');
    // Verify negative sign on amount
    expect(html).toContain('>-1,500<');
  });

  it('renders both arrears and advance adjustments together seamlessly', () => {
    const challan = {
      challanNumber: '82485249',
      month: 'December',
      session: '2026-2027',
      installmentNumber: 4,
      basePayable: 10000,
      amount: 10000,
      arrearsAmount: 2000,
      arrearAllocations: [
        {
          sourceChallanNo: 'CH-1001',
          sourceInstallmentNumber: 1,
          sourceMonth: 'September',
          amountCarriedForward: 2000,
        },
      ],
      advanceApplied: 500,
      advanceFromChallanNo: 'CH-1003',
      advanceFromMonth: 'November',
      challanHeads: [],
      student: {
        fName: 'Bilal',
        lName: 'Tariq',
      },
    };

    const html = generateChallanHtml(challan, sampleTemplate);

    // Both rows present
    expect(html).toContain('September (Installment 1) - Challan #CH-1001 (Arrears)');
    expect(html).toContain('>2,000<');
    expect(html).toContain('November - Challan #CH-1003 (Advance Adjustment)');
    expect(html).toContain('>-500<');
  });

  it('renders Advance Payment row when student pays extra on a challan', () => {
    const challan = {
      challanNumber: '11586133',
      month: 'October',
      session: '2026-2027',
      installmentNumber: 2,
      basePayable: 10000,
      amount: 10000,
      arrearsAmount: 10000,
      totalAmount: 20000,
      paidAmount: 30000,
      excessCreditGenerated: 10000,
      status: 'PAID',
      student: { fName: 'Test', lName: 'Student' },
    };

    const html = generateChallanHtml(challan, sampleTemplate);

    expect(html).toContain('Total Amount');
    expect(html).toContain('>20,000<');
    expect(html).toContain('Paid Amount');
    expect(html).toContain('>30,000<');
    expect(html).toContain('Advance Payment (November - Installment 3)');
    expect(html).toContain('>10,000<');
  });

  it('renders advance-covered installment with negative adjustment and Advance paid indicator', () => {
    const challan = {
      challanNumber: '20641404',
      month: 'November',
      session: '2026-2027',
      installmentNumber: 3,
      basePayable: 10000,
      amount: 10000,
      advanceApplied: 10000,
      advanceFromChallanNo: '11586133',
      advanceFromMonth: 'October',
      totalAmount: 0,
      paidAmount: 10000,
      status: 'PAID',
      student: { fName: 'Test', lName: 'Student' },
    };

    const html = generateChallanHtml(challan, sampleTemplate);

    expect(html).toContain('October - Challan #11586133 (Advance Adjustment)');
    expect(html).toContain('>-10,000<');
    expect(html).toContain('Total Amount');
    expect(html).toContain('>0<');
    expect(html).not.toContain('<td>Paid Amount</td>');
  });

  it('resolves Paid By to staff/admin name instead of payment mode "Cash"', () => {
    // 1. Direct receivedByName takes priority
    const challanWithStaff = {
      challanNumber: '11586133',
      status: 'PAID',
      paidAmount: 20000,
      totalAmount: 20000,
      paidBy: 'Cash',
      receivedByName: 'Super Admin',
    };
    expect(getPaidByText(challanWithStaff)).toBe('Super Admin');

    // 2. Specific staff name in paidBy (non-generic)
    const challanStaffPaidBy = {
      challanNumber: '11586134',
      status: 'PAID',
      paidAmount: 15000,
      paidBy: 'Teacher 1',
    };
    expect(getPaidByText(challanStaffPaidBy)).toBe('Teacher 1');

    // 3. Fallback when paidBy is generic "Cash"
    const challanOnlyCash = {
      challanNumber: '11586135',
      status: 'PAID',
      paidAmount: 10000,
      paidBy: 'Cash',
    };
    expect(getPaidByText(challanOnlyCash)).toBe('Super Admin');

    // 4. Advance covered challan resolves payer name from source advance challan
    const sourceChallan = {
      id: 'src-1',
      challanNo: '11586133',
      challanNumber: '11586133',
      status: 'PAID',
      paidBy: 'Cash',
      receivedByName: 'Super Admin',
    };
    const advanceChallan = {
      id: 'adv-1',
      challanNumber: '20641404',
      status: 'PAID',
      paidBy: 'Advance Credit',
      advanceFromChallanNo: '11586133',
    };
    expect(getPaidByText(advanceChallan, [sourceChallan])).toBe('Super Admin');

    // 5. Challan settled via arrears resolves payer name from settling challan
    const settledChallan = {
      id: 'set-1',
      challanNumber: '30590084',
      status: 'SETTLED',
      paidBy: 'Cash',
      settledByChallanNo: '11586133',
    };
    expect(getPaidByText(settledChallan, [sourceChallan])).toBe('Super Admin');
  });

  it('renders Paid By with staff/admin name in print treatment table', () => {
    const challan = {
      challanNumber: '11586133',
      status: 'PAID',
      paidAmount: 20000,
      totalAmount: 20000,
      paidDate: '2026-10-01T20:43:00.000Z',
      paidBy: 'Cash',
      receivedByName: 'Super Admin',
    };

    const baseHtml = `
      <table>
        <tbody>
          <tr><td>Tuition</td><td>20,000</td></tr>
          <tr><td>Remarks</td><td>-</td></tr>
        </tbody>
      </table>
    `;

    const html = applyPaidChallanPrintTreatment(baseHtml, challan);
    expect(html).toContain('Paid By');
    expect(html).toContain('Super Admin');
    expect(html).not.toMatch(/Paid By<\/td>\s*<td[^>]*>Cash<\/td>/);
  });

  it('renders Total Amount row and handles advance-only and unpaid challans according to print treatment', () => {
    // 1. Partial advance challan (like 34 PKR advance on 8,166 PKR tuition, advance-only transaction)
    const partialChallan = {
      challanNumber: '62902251',
      month: 'October',
      session: '2026-2027',
      installmentNumber: 2,
      basePayable: 8166,
      amount: 8166,
      advanceApplied: 34,
      advanceFromChallanNo: 'CH-62902250',
      advanceFromMonth: 'September',
      status: 'PENDING',
      paidAmount: 0,
      student: { fName: 'John', lName: 'Doe' },
    };

    const partialHtml = generateChallanHtml(partialChallan, sampleTemplate);

    // Must have Total Amount row (8,132), but Paid Amount is hidden for advance-only transaction
    expect(partialHtml).toContain('<td>Total Amount</td>');
    expect(partialHtml).toContain('<td>8,132</td>');
    expect(partialHtml).not.toContain('<td>Paid Amount</td>');

    // 2. Unpaid PENDING challan without advance (completely unpaid)
    const pendingChallan = {
      challanNumber: '12345678',
      month: 'November',
      session: '2026-2027',
      installmentNumber: 3,
      basePayable: 10000,
      amount: 10000,
      status: 'PENDING',
      paidAmount: 0,
      student: { fName: 'Jane', lName: 'Doe' },
    };

    const pendingHtml = generateChallanHtml(pendingChallan, sampleTemplate);
    expect(pendingHtml).toContain('<td>Total Amount</td>');
    expect(pendingHtml).toContain('<td>10,000</td>');
    expect(pendingHtml).not.toContain('<td>Paid Amount</td>');

    // 3. Paid Challan with cash/direct payment -> Paid Amount row is rendered
    const paidChallan = {
      challanNumber: '99887766',
      month: 'December',
      session: '2026-2027',
      installmentNumber: 4,
      basePayable: 10000,
      amount: 10000,
      status: 'PAID',
      paidAmount: 10000,
      student: { fName: 'Jane', lName: 'Doe' },
    };
    const paidHtml = generateChallanHtml(paidChallan, sampleTemplate);
    expect(paidHtml).toContain('<td>Total Amount</td>');
    expect(paidHtml).toContain('<td>Paid Amount</td>');
    expect(paidHtml).toContain('<td>10,000</td>');
  });
});

