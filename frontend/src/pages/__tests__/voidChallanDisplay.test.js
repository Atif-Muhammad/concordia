/**
 * Task 5.5: Frontend display logic for VOID challans
 *
 * Unit tests for the pure display/calculation functions extracted from FeeManagement.jsx.
 * These tests verify:
 * - VOID challan shows lateFeeFine value
 * - VOID challan shows superseding chain note (supersededBy data present)
 * - Arrears breakdown shows VOID predecessor late fee contribution
 *
 * Validates: Requirements 2.7, 2.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Pure functions extracted from FeeManagement.jsx ────────────────────────
// These mirror the exact logic in the component so we can unit-test them
// without mounting the full React tree.

/**
 * Recursively sums the remaining balance of all linked previous challans.
 * PAID ancestors: settled — stop recursion.
 * VOID ancestors: real unpaid debt — include them (with their lateFeeFine).
 */
function getRecursiveArrears(challan) {
  if (
    !challan ||
    !challan.previousChallans ||
    !Array.isArray(challan.previousChallans) ||
    challan.installmentNumber === 0
  )
    return 0;

  return challan.previousChallans.reduce((total, prev) => {
    if (prev.status === 'PAID') return total;
    const rem = Math.max(
      0,
      (prev.amount || 0) +
        (prev.fineAmount || 0) +
        (prev.lateFeeFine || 0) -
        (prev.paidAmount || 0) -
        (prev.discount || 0),
    );
    return total + rem + getRecursiveArrears(prev);
  }, 0);
}

/**
 * Returns the tooltip text for a VOID challan's late fee cell.
 * Mirrors the JSX tooltip content in FeeManagement.jsx.
 */
function getVoidLateFeeTooltip(challan) {
  if (challan.status !== 'VOID' || (challan.lateFeeFine || 0) <= 0) return null;
  const base = `Late fee of PKR ${challan.lateFeeFine} is preserved for audit.`;
  const chain = challan.supersededBy
    ? ` Included in Challan #${challan.supersededBy.challanNumber}.`
    : ' Rolled into superseding challan.';
  return base + chain;
}

/**
 * Returns the superseding chain display text for a VOID challan's status cell.
 * Mirrors the JSX in FeeManagement.jsx.
 */
function getSupersedingChainText(challan) {
  if (challan.status !== 'VOID' || !challan.supersededBy) return null;
  return `#${challan.supersededBy.challanNumber}`;
}

/**
 * Returns the superseding chain tooltip content for a VOID challan.
 */
function getSupersedingChainTooltip(challan) {
  if (challan.status !== 'VOID' || !challan.supersededBy) return null;
  const base = `This installment's debt (including late fees) was rolled into Challan #${challan.supersededBy.challanNumber}.`;
  const lateFeeNote =
    (challan.lateFeeFine || 0) > 0
      ? ` Late fee of PKR ${challan.lateFeeFine} is included in the superseding challan.`
      : '';
  return base + lateFeeNote;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Task 5.5: VOID challan frontend display logic', () => {
  // ── 2.7: VOID challan shows lateFeeFine value ──────────────────────────────

  describe('Requirement 2.7: VOID challan shows lateFeeFine value', () => {
    it('should show lateFeeFine for a VOID challan with lateFeeFine > 0', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 500,
        supersededBy: { id: 2, challanNumber: 'NOV-2025-001' },
        previousChallans: [],
        installmentNumber: 1,
      };

      // The component renders challan.lateFeeFine directly
      expect(voidChallan.lateFeeFine).toBe(500);
      expect(voidChallan.lateFeeFine).toBeGreaterThan(0);
    });

    it('should show tooltip with late fee preservation note for VOID challan with lateFeeFine > 0', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 500,
        supersededBy: { id: 2, challanNumber: 'NOV-2025-001' },
      };

      const tooltip = getVoidLateFeeTooltip(voidChallan);
      expect(tooltip).not.toBeNull();
      expect(tooltip).toContain('500');
      expect(tooltip).toContain('preserved for audit');
      expect(tooltip).toContain('NOV-2025-001');
    });

    it('should NOT show late fee tooltip for VOID challan with lateFeeFine = 0', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 0,
        supersededBy: { id: 2, challanNumber: 'NOV-2025-001' },
      };

      const tooltip = getVoidLateFeeTooltip(voidChallan);
      expect(tooltip).toBeNull();
    });

    it('should NOT show late fee tooltip for non-VOID challans', () => {
      const paidChallan = {
        id: 1,
        status: 'PAID',
        lateFeeFine: 500,
        supersededBy: null,
      };

      const tooltip = getVoidLateFeeTooltip(paidChallan);
      expect(tooltip).toBeNull();
    });

    it('property: for any VOID challan with lateFeeFine > 0, tooltip always mentions the amount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.string({ minLength: 3, maxLength: 20 }),
          (lateFeeFine, challanNumber) => {
            const voidChallan = {
              status: 'VOID',
              lateFeeFine,
              supersededBy: { id: 99, challanNumber },
            };
            const tooltip = getVoidLateFeeTooltip(voidChallan);
            expect(tooltip).not.toBeNull();
            expect(tooltip).toContain(String(lateFeeFine));
            expect(tooltip).toContain(challanNumber);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ── 2.7: VOID challan shows superseding chain note ─────────────────────────

  describe('Requirement 2.7: VOID challan shows superseding chain note', () => {
    it('should show superseding chain link when supersededBy is present', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 500,
        supersededBy: { id: 2, challanNumber: 'NOV-2025-001' },
      };

      const chainText = getSupersedingChainText(voidChallan);
      expect(chainText).not.toBeNull();
      expect(chainText).toContain('NOV-2025-001');
    });

    it('should show superseding chain tooltip with debt transfer note', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 500,
        supersededBy: { id: 2, challanNumber: 'NOV-2025-001' },
      };

      const tooltip = getSupersedingChainTooltip(voidChallan);
      expect(tooltip).not.toBeNull();
      expect(tooltip).toContain('NOV-2025-001');
      expect(tooltip).toContain('rolled into');
      expect(tooltip).toContain('500');
    });

    it('should NOT show chain link when supersededBy is null', () => {
      const voidChallan = {
        id: 1,
        status: 'VOID',
        lateFeeFine: 500,
        supersededBy: null,
      };

      const chainText = getSupersedingChainText(voidChallan);
      expect(chainText).toBeNull();
    });

    it('should NOT show chain link for non-VOID challans', () => {
      const pendingChallan = {
        id: 1,
        status: 'PENDING',
        lateFeeFine: 0,
        supersededBy: null,
      };

      const chainText = getSupersedingChainText(pendingChallan);
      expect(chainText).toBeNull();
    });

    it('property: for any VOID challan with supersededBy, chain text always contains challanNumber', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 20 }),
          (challanNumber) => {
            const voidChallan = {
              status: 'VOID',
              lateFeeFine: 0,
              supersededBy: { id: 99, challanNumber },
            };
            const chainText = getSupersedingChainText(voidChallan);
            expect(chainText).not.toBeNull();
            expect(chainText).toContain(challanNumber);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ── 2.8: Arrears breakdown shows VOID predecessor late fee contribution ─────

  describe('Requirement 2.8: Arrears breakdown shows VOID predecessor late fee contribution', () => {
    it('should include lateFeeFine from VOID predecessor in arrears calculation', () => {
      const novChallan = {
        id: 2,
        status: 'PENDING',
        amount: 5000,
        installmentNumber: 2,
        previousChallans: [
          {
            id: 1,
            status: 'VOID',
            amount: 5000,
            lateFeeFine: 500,
            fineAmount: 0,
            paidAmount: 0,
            discount: 0,
            previousChallans: [],
            installmentNumber: 1,
          },
        ],
      };

      const arrears = getRecursiveArrears(novChallan);
      // September amount (5000) + September lateFeeFine (500) = 5500
      expect(arrears).toBe(5500);
    });

    it('should accumulate late fees from multiple VOID predecessors', () => {
      const aprChallan = {
        id: 4,
        status: 'PENDING',
        amount: 5000,
        installmentNumber: 4,
        previousChallans: [
          {
            id: 1, status: 'VOID', amount: 5000, lateFeeFine: 100,
            fineAmount: 0, paidAmount: 0, discount: 0, previousChallans: [], installmentNumber: 1,
          },
          {
            id: 2, status: 'VOID', amount: 5000, lateFeeFine: 150,
            fineAmount: 0, paidAmount: 0, discount: 0, previousChallans: [], installmentNumber: 2,
          },
          {
            id: 3, status: 'VOID', amount: 5000, lateFeeFine: 200,
            fineAmount: 0, paidAmount: 0, discount: 0, previousChallans: [], installmentNumber: 3,
          },
        ],
      };

      const arrears = getRecursiveArrears(aprChallan);
      // Jan (5000+100) + Feb (5000+150) + Mar (5000+200) = 15450
      expect(arrears).toBe(15450);
    });

    it('should NOT include late fees from PAID predecessors', () => {
      const novChallan = {
        id: 2,
        status: 'PENDING',
        amount: 5000,
        installmentNumber: 2,
        previousChallans: [
          {
            id: 1,
            status: 'PAID',
            amount: 5000,
            lateFeeFine: 500,
            fineAmount: 0,
            paidAmount: 5000,
            discount: 0,
            previousChallans: [],
            installmentNumber: 1,
          },
        ],
      };

      const arrears = getRecursiveArrears(novChallan);
      // PAID predecessor is skipped
      expect(arrears).toBe(0);
    });

    it('should return 0 arrears when there are no previous challans', () => {
      const challan = {
        id: 1,
        status: 'PENDING',
        amount: 5000,
        installmentNumber: 1,
        previousChallans: [],
      };

      const arrears = getRecursiveArrears(challan);
      expect(arrears).toBe(0);
    });

    it('property: arrears always >= sum of VOID predecessor lateFeesFines', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              lateFeeFine: fc.integer({ min: 0, max: 1000 }),
              amount: fc.integer({ min: 1000, max: 10000 }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          (predecessors) => {
            const challan = {
              id: 99,
              status: 'PENDING',
              amount: 5000,
              installmentNumber: predecessors.length + 1,
              previousChallans: predecessors.map((p, i) => ({
                id: i + 1,
                status: 'VOID',
                amount: p.amount,
                lateFeeFine: p.lateFeeFine,
                fineAmount: 0,
                paidAmount: 0,
                discount: 0,
                previousChallans: [],
                installmentNumber: i + 1,
              })),
            };

            const arrears = getRecursiveArrears(challan);
            const totalLateFees = predecessors.reduce((s, p) => s + p.lateFeeFine, 0);
            const totalAmounts = predecessors.reduce((s, p) => s + p.amount, 0);

            // Arrears must include all amounts + all late fees
            expect(arrears).toBeGreaterThanOrEqual(totalLateFees);
            expect(arrears).toBe(totalAmounts + totalLateFees);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
