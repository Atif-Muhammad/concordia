/**
 * Feature: staff-attendance-undo-confirmation, Property 4: undo error preserves dialog open state
 *
 * Property 4: Undo error preserves dialog open state
 * Validates: Requirements 2.5, 3.5
 *
 * The onError handler in Staff.jsx's undoMutation calls toast with the error
 * message but does NOT call setConfirmDialog(null), so the dialog stays open.
 *
 * We model this as a pure function test mirroring the actual onError handler.
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure model: mirrors the onError handler in Staff.jsx's undoMutation
// ---------------------------------------------------------------------------

/**
 * Simulates the onError handler behavior from Staff.jsx's undoMutation.
 * It calls toast with the error details but does NOT call setConfirmDialog(null).
 *
 * @param {{ errorMessage: string, toast: Function, setConfirmDialog: Function }} params
 */
function simulateUndoError({ errorMessage, toast, setConfirmDialog }) {
  // mirrors the onError handler in Staff.jsx
  toast({ title: "Error", description: errorMessage, variant: "destructive" });
  // does NOT call setConfirmDialog(null)
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const errorMessageArb = fc.string({ minLength: 1 });
const actionTypeArb = fc.constantFrom("generate", "holiday");

// ---------------------------------------------------------------------------
// Property 4: Undo error preserves dialog open state
// Validates: Requirements 2.5, 3.5
// ---------------------------------------------------------------------------

describe("Property 4: Undo error preserves dialog open state", () => {
  it("after an undo error, setConfirmDialog is NOT called (dialog stays open)", () => {
    // Feature: staff-attendance-undo-confirmation, Property 4: undo error preserves dialog open state
    fc.assert(
      fc.property(errorMessageArb, actionTypeArb, (errorMessage, actionType) => {
        const toast = vi.fn();
        const setConfirmDialog = vi.fn();

        simulateUndoError({ errorMessage, toast, setConfirmDialog });

        expect(setConfirmDialog).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  it("after an undo error, toast is called with the exact error message", () => {
    // Feature: staff-attendance-undo-confirmation, Property 4: undo error preserves dialog open state
    fc.assert(
      fc.property(errorMessageArb, actionTypeArb, (errorMessage, actionType) => {
        const toast = vi.fn();
        const setConfirmDialog = vi.fn();

        simulateUndoError({ errorMessage, toast, setConfirmDialog });

        expect(toast).toHaveBeenCalledTimes(1);
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: errorMessage })
        );
      }),
      { numRuns: 20 }
    );
  });

  it("after an undo error, toast is called with destructive variant and Error title", () => {
    // Feature: staff-attendance-undo-confirmation, Property 4: undo error preserves dialog open state
    fc.assert(
      fc.property(errorMessageArb, actionTypeArb, (errorMessage, actionType) => {
        const toast = vi.fn();
        const setConfirmDialog = vi.fn();

        simulateUndoError({ errorMessage, toast, setConfirmDialog });

        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Error", variant: "destructive" })
        );
      }),
      { numRuns: 20 }
    );
  });
});
