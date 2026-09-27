import { describe, it, expect } from 'vitest';
import { generateChallanHtml, resolveHeadName } from '../fee-management/feeFinancialUtils';

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
});
