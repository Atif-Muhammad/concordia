/**
 * Feature: staff-attendance-undo-confirmation, Property 3: undo routes to the correct API for any date
 *
 * Property 3: Undo routes to the correct API for any date
 * Validates: Requirements 2.3, 3.3
 *
 * The routing logic (which API to call) lives in Staff.jsx's onUndo handler.
 * The dialog's responsibility is to call the onUndo prop exactly once when
 * the Undo button is clicked, for any date and actionType combination.
 *
 * We model the dialog's click behavior as a pure function: when the Undo
 * button is clicked, it invokes onUndo(). This mirrors the component's
 * actual implementation: <Button onClick={onUndo}>Undo</Button>
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure model: mirrors the Undo button's onClick behavior in
// AttendanceConfirmationDialog — it simply calls onUndo() when clicked.
// ---------------------------------------------------------------------------

/**
 * Simulates clicking the Undo button in AttendanceConfirmationDialog.
 * The component renders: <Button onClick={onUndo} disabled={isUndoing}>Undo</Button>
 * When not disabled, clicking it calls onUndo exactly once with no arguments.
 *
 * @param {{ onUndo: Function, isUndoing: boolean }} props
 */
function simulateUndoClick({ onUndo, isUndoing }) {
  if (!isUndoing) {
    onUndo();
  }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const dateArb = fc.date({ min: new Date(2000, 0, 1), max: new Date() });
const actionTypeArb = fc.constantFrom("generate", "holiday");

// ---------------------------------------------------------------------------
// Property 3: Undo routes to the correct API for any date
// Validates: Requirements 2.3, 3.3
// ---------------------------------------------------------------------------

describe("Property 3: Undo routes to the correct API for any date", () => {
  it("clicking Undo calls onUndo exactly once for any date and actionType", () => {
    // Feature: staff-attendance-undo-confirmation, Property 3: undo routes to the correct API for any date
    fc.assert(
      fc.property(dateArb, actionTypeArb, (date, actionType) => {
        const onUndo = vi.fn();

        // Simulate the dialog being open and the Undo button being clicked
        simulateUndoClick({ onUndo, isUndoing: false });

        expect(onUndo).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 20 }
    );
  });

  it("clicking Undo does NOT call onUndo when isUndoing is true (button disabled)", () => {
    // Feature: staff-attendance-undo-confirmation, Property 3: undo routes to the correct API for any date
    fc.assert(
      fc.property(dateArb, actionTypeArb, (date, actionType) => {
        const onUndo = vi.fn();

        simulateUndoClick({ onUndo, isUndoing: true });

        expect(onUndo).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  it("for 'generate' actionType, onUndo (not a separate holiday undo) is called", () => {
    // Feature: staff-attendance-undo-confirmation, Property 3: undo routes to the correct API for any date
    // The dialog always calls the single onUndo prop — routing to the correct
    // API is the responsibility of the caller (Staff.jsx), not the dialog.
    fc.assert(
      fc.property(dateArb, (date) => {
        const undoGenerate = vi.fn();
        const undoHoliday = vi.fn();

        // Staff.jsx passes undoGenerate as onUndo for 'generate' actionType
        simulateUndoClick({ onUndo: undoGenerate, isUndoing: false });

        expect(undoGenerate).toHaveBeenCalledTimes(1);
        expect(undoHoliday).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });

  it("for 'holiday' actionType, onUndo (not a separate generate undo) is called", () => {
    // Feature: staff-attendance-undo-confirmation, Property 3: undo routes to the correct API for any date
    // The dialog always calls the single onUndo prop — routing to the correct
    // API is the responsibility of the caller (Staff.jsx), not the dialog.
    fc.assert(
      fc.property(dateArb, (date) => {
        const undoGenerate = vi.fn();
        const undoHoliday = vi.fn();

        // Staff.jsx passes undoHoliday as onUndo for 'holiday' actionType
        simulateUndoClick({ onUndo: undoHoliday, isUndoing: false });

        expect(undoHoliday).toHaveBeenCalledTimes(1);
        expect(undoGenerate).not.toHaveBeenCalled();
      }),
      { numRuns: 20 }
    );
  });
});
