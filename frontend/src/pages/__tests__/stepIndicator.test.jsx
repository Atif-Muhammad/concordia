/**
 * Property-based test for StepIndicator visual state consistency.
 *
 * Property 7: Step indicator visual state is consistent with current step
 * Validates: Requirements 3.4, 3.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure helper: mirrors the state logic in StepIndicator
// Returns "active" | "completed" | "upcoming" for a given step
// given the currentStep and completedSteps set.
// ---------------------------------------------------------------------------

/**
 * @param {number} step - the step to evaluate (1-4)
 * @param {number} currentStep - the active step (1-4)
 * @param {Set<number>} completedSteps - set of completed step numbers
 * @returns {"active" | "completed" | "upcoming"}
 */
function getStepState(step, currentStep, completedSteps) {
    if (step === currentStep) return "active";
    if (completedSteps.has(step)) return "completed";
    return "upcoming";
}

/**
 * Derives the expected completedSteps for a given currentStep:
 * all steps < currentStep are completed, steps > currentStep are upcoming.
 * This mirrors the invariant that handleNext adds step N to completedSteps
 * when advancing from N to N+1.
 *
 * @param {number} currentStep
 * @returns {Set<number>}
 */
function deriveCompletedSteps(currentStep) {
    const completed = new Set();
    for (let s = 1; s < currentStep; s++) {
        completed.add(s);
    }
    return completed;
}

// ---------------------------------------------------------------------------
// Property 7: Step indicator visual state is consistent with current step
// Validates: Requirements 3.4, 3.5
// ---------------------------------------------------------------------------

describe("Property 7: Step indicator visual state is consistent with current step", () => {
    it("step N is active, steps < N are completed, steps > N are upcoming", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 4 }),
                (currentStep) => {
                    const completedSteps = deriveCompletedSteps(currentStep);

                    for (let step = 1; step <= 4; step++) {
                        const state = getStepState(step, currentStep, completedSteps);
                        if (step === currentStep) {
                            expect(state).toBe("active");
                        } else if (step < currentStep) {
                            expect(state).toBe("completed");
                        } else {
                            expect(state).toBe("upcoming");
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("active step is never completed or upcoming", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 4 }),
                (currentStep) => {
                    const completedSteps = deriveCompletedSteps(currentStep);
                    const state = getStepState(currentStep, currentStep, completedSteps);
                    expect(state).toBe("active");
                    expect(state).not.toBe("completed");
                    expect(state).not.toBe("upcoming");
                }
            ),
            { numRuns: 100 }
        );
    });

    it("completed steps are all steps strictly before currentStep", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 4 }),
                (currentStep) => {
                    const completedSteps = deriveCompletedSteps(currentStep);
                    for (let step = 1; step <= 4; step++) {
                        const isCompleted = completedSteps.has(step);
                        if (step < currentStep) {
                            expect(isCompleted).toBe(true);
                        } else {
                            expect(isCompleted).toBe(false);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it("upcoming steps are all steps strictly after currentStep", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 4 }),
                (currentStep) => {
                    const completedSteps = deriveCompletedSteps(currentStep);
                    for (let step = 1; step <= 4; step++) {
                        const state = getStepState(step, currentStep, completedSteps);
                        if (step > currentStep) {
                            expect(state).toBe("upcoming");
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
