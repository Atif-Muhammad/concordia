// Feature: staff-attendance-undo-confirmation, Property 2: confirmation message contains the formatted date

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { format } from "date-fns";
import { buildConfirmationMessage } from "../../components/AttendanceConfirmationDialog";

describe("Property 2: confirmation message contains the formatted date", () => {
  it("includes the formatted date for any past/present date and either action type", () => {
    // Validates: Requirements 2.1
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2000, 0, 1), max: startOfToday, noInvalidDate: true }),
        fc.constantFrom("generate", "holiday"),
        (date, actionType) => {
          if (isNaN(date.getTime())) return true;
          const msg = buildConfirmationMessage(actionType, date);
          return msg.includes(format(date, "PPP"));
        }
      ),
      { numRuns: 20 }
    );
  });
});
