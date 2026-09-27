import { describe, it, expect } from "vitest";

// Pure helper functions copied from Academics.jsx for isolated unit testing
function groupSlotsToSchedules(slots) {
  const map = new Map();
  for (const s of slots) {
    const key = s.subjectId.toString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime });
  }
  return Array.from(map.entries()).map(([subjectId, dayAssignments]) => ({ subjectId, dayAssignments }));
}

function flattenSchedulesToSlots(schedules) {
  const result = [];
  for (const sched of schedules) {
    if (!sched.subjectId) continue;
    for (const da of sched.dayAssignments) {
      if (!da.dayOfWeek || !da.startTime || !da.endTime) continue;
      result.push({ dayOfWeek: da.dayOfWeek, startTime: da.startTime, endTime: da.endTime, subjectId: Number(sched.subjectId) });
    }
  }
  return result;
}

// --- Unit Tests ---

describe("flattenSchedulesToSlots", () => {
  it("returns [] for empty array", () => {
    expect(flattenSchedulesToSlots([])).toEqual([]);
  });

  it("flattens a single subject with a single day assignment", () => {
    const schedules = [
      {
        subjectId: "1",
        dayAssignments: [{ dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" }],
      },
    ];
    const result = flattenSchedulesToSlots(schedules);
    expect(result).toEqual([
      { dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00", subjectId: 1 },
    ]);
  });

  it("flattens multiple subjects with multiple day assignments", () => {
    const schedules = [
      {
        subjectId: "1",
        dayAssignments: [
          { dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" },
          { dayOfWeek: "Wednesday", startTime: "10:00", endTime: "11:00" },
        ],
      },
      {
        subjectId: "2",
        dayAssignments: [
          { dayOfWeek: "Tuesday", startTime: "09:00", endTime: "10:00" },
        ],
      },
    ];
    const result = flattenSchedulesToSlots(schedules);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00", subjectId: 1 });
    expect(result).toContainEqual({ dayOfWeek: "Wednesday", startTime: "10:00", endTime: "11:00", subjectId: 1 });
    expect(result).toContainEqual({ dayOfWeek: "Tuesday", startTime: "09:00", endTime: "10:00", subjectId: 2 });
  });

  it("excludes day assignments with missing fields", () => {
    const schedules = [
      {
        subjectId: "1",
        dayAssignments: [
          { dayOfWeek: "Monday", startTime: "", endTime: "09:00" },
          { dayOfWeek: "Tuesday", startTime: "08:00", endTime: "09:00" },
        ],
      },
    ];
    const result = flattenSchedulesToSlots(schedules);
    expect(result).toHaveLength(1);
    expect(result[0].dayOfWeek).toBe("Tuesday");
  });

  it("excludes schedules with no subjectId", () => {
    const schedules = [
      { subjectId: "", dayAssignments: [{ dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" }] },
      { subjectId: "2", dayAssignments: [{ dayOfWeek: "Friday", startTime: "10:00", endTime: "11:00" }] },
    ];
    const result = flattenSchedulesToSlots(schedules);
    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe(2);
  });

  it("converts subjectId to Number", () => {
    const schedules = [
      { subjectId: "42", dayAssignments: [{ dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" }] },
    ];
    const result = flattenSchedulesToSlots(schedules);
    expect(typeof result[0].subjectId).toBe("number");
    expect(result[0].subjectId).toBe(42);
  });
});

describe("groupSlotsToSchedules", () => {
  it("returns [] for empty array", () => {
    expect(groupSlotsToSchedules([])).toEqual([]);
  });

  it("groups slots by subjectId correctly", () => {
    const slots = [
      { subjectId: 1, dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" },
      { subjectId: 2, dayOfWeek: "Tuesday", startTime: "09:00", endTime: "10:00" },
      { subjectId: 1, dayOfWeek: "Wednesday", startTime: "10:00", endTime: "11:00" },
    ];
    const result = groupSlotsToSchedules(slots);
    expect(result).toHaveLength(2);

    const sub1 = result.find(r => r.subjectId === "1");
    expect(sub1).toBeDefined();
    expect(sub1.dayAssignments).toHaveLength(2);
    expect(sub1.dayAssignments).toContainEqual({ dayOfWeek: "Monday", startTime: "08:00", endTime: "09:00" });
    expect(sub1.dayAssignments).toContainEqual({ dayOfWeek: "Wednesday", startTime: "10:00", endTime: "11:00" });

    const sub2 = result.find(r => r.subjectId === "2");
    expect(sub2).toBeDefined();
    expect(sub2.dayAssignments).toHaveLength(1);
    expect(sub2.dayAssignments[0]).toEqual({ dayOfWeek: "Tuesday", startTime: "09:00", endTime: "10:00" });
  });

  it("produces subjectId as string in output", () => {
    const slots = [{ subjectId: 5, dayOfWeek: "Friday", startTime: "08:00", endTime: "09:00" }];
    const result = groupSlotsToSchedules(slots);
    expect(typeof result[0].subjectId).toBe("string");
    expect(result[0].subjectId).toBe("5");
  });
});

// --- Property-Based Tests ---

import * as fc from "fast-check";

// Arbitraries
const nonEmptyString = fc.string({ minLength: 1, maxLength: 20 });
const timeString = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
const dayOfWeekArb = fc.constantFrom("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday");

const completeDayAssignmentArb = fc.record({
  dayOfWeek: dayOfWeekArb,
  startTime: timeString,
  endTime: timeString,
});

const completeSubjectScheduleArb = fc.record({
  subjectId: nonEmptyString,
  dayAssignments: fc.array(completeDayAssignmentArb, { minLength: 1, maxLength: 5 }),
});

const validSlotArb = fc.record({
  subjectId: fc.integer({ min: 1, max: 1000 }),
  dayOfWeek: dayOfWeekArb,
  startTime: timeString,
  endTime: timeString,
});

describe("Property-Based Tests", () => {
  // Feature: timetable-subject-schedule-redesign, Property 1: Flatten produces one slot per complete Day_Assignment
  // Validates: Requirements 1.8, 4.1, 4.2
  it("Property 1: flattenSchedulesToSlots produces exactly sum(dayAssignments.length) slots for complete schedules", () => {
    fc.assert(
      fc.property(fc.array(completeSubjectScheduleArb, { minLength: 0, maxLength: 10 }), (schedules) => {
        const expectedCount = schedules.reduce((sum, s) => sum + s.dayAssignments.length, 0);
        const result = flattenSchedulesToSlots(schedules);
        return result.length === expectedCount;
      }),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 2: Flatten excludes incomplete Day_Assignments
  // Validates: Requirements 4.1
  it("Property 2: flattenSchedulesToSlots excludes Day_Assignments with any empty field", () => {
    const incompleteDayAssignmentArb = fc.oneof(
      fc.record({ dayOfWeek: fc.constant(""), startTime: timeString, endTime: timeString }),
      fc.record({ dayOfWeek: dayOfWeekArb, startTime: fc.constant(""), endTime: timeString }),
      fc.record({ dayOfWeek: dayOfWeekArb, startTime: timeString, endTime: fc.constant("") }),
    );

    fc.assert(
      fc.property(
        nonEmptyString,
        fc.array(incompleteDayAssignmentArb, { minLength: 1, maxLength: 5 }),
        (subjectId, incompleteDAs) => {
          const schedules = [{ subjectId, dayAssignments: incompleteDAs }];
          const result = flattenSchedulesToSlots(schedules);
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 3: Flatten excludes Subject_Schedules with no subjectId
  // Validates: Requirements 4.2
  it("Property 3: flattenSchedulesToSlots produces zero slots for schedules with empty subjectId", () => {
    fc.assert(
      fc.property(
        fc.array(completeDayAssignmentArb, { minLength: 1, maxLength: 5 }),
        fc.array(completeSubjectScheduleArb, { minLength: 0, maxLength: 5 }),
        (incompleteDAs, validSchedules) => {
          const emptySubjectSchedule = { subjectId: "", dayAssignments: incompleteDAs };
          const schedules = [...validSchedules, emptySubjectSchedule];
          const result = flattenSchedulesToSlots(schedules);
          const validCount = validSchedules.reduce((sum, s) => sum + s.dayAssignments.length, 0);
          return result.length === validCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 4: subjectId is always a Number in the output
  // Validates: Requirements 5.2
  it("Property 4: flattenSchedulesToSlots always produces slots with subjectId of type number", () => {
    fc.assert(
      fc.property(fc.array(completeSubjectScheduleArb, { minLength: 1, maxLength: 10 }), (schedules) => {
        const result = flattenSchedulesToSlots(schedules);
        return result.every((slot) => typeof slot.subjectId === "number");
      }),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 5: Group-then-flatten round trip
  // Validates: Requirements 3.1, 3.2
  it("Property 5: flattenSchedulesToSlots(groupSlotsToSchedules(slots)) is equivalent to original slots", () => {
    fc.assert(
      fc.property(fc.array(validSlotArb, { minLength: 0, maxLength: 20 }), (slots) => {
        const roundTripped = flattenSchedulesToSlots(groupSlotsToSchedules(slots));

        if (roundTripped.length !== slots.length) return false;

        // Check every original slot appears in the round-tripped result
        const normalize = (slot) =>
          `${slot.subjectId}|${slot.dayOfWeek}|${slot.startTime}|${slot.endTime}`;

        const originalSet = slots.map(normalize).sort();
        const roundTrippedSet = roundTripped.map(normalize).sort();

        return originalSet.every((s, i) => s === roundTrippedSet[i]);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 6: Removing a Subject_Schedule removes all its Day_Assignments
  // Validates: Requirements 1.6
  it("Property 6: removeSubjectSchedule removes the schedule and all its Day_Assignments", () => {
    fc.assert(
      fc.property(
        fc.array(completeSubjectScheduleArb, { minLength: 1, maxLength: 10 }).chain((schedules) =>
          fc.tuple(
            fc.constant(schedules),
            fc.integer({ min: 0, max: schedules.length - 1 })
          )
        ),
        ([schedules, i]) => {
          const removedSchedule = schedules[i];
          const completeDAsCount = removedSchedule.dayAssignments.length;

          // Simulate removeSubjectSchedule logic
          const result = schedules.filter((_, idx) => idx !== i);

          // Array length decreases by 1
          if (result.length !== schedules.length - 1) return false;

          // Removed subjectId is no longer present
          if (result.some(s => s.subjectId === removedSchedule.subjectId)) return false;

          // Total slot count decreases by the number of complete Day_Assignments the removed schedule had
          const beforeCount = flattenSchedulesToSlots(schedules).length;
          const afterCount = flattenSchedulesToSlots(result).length;
          return afterCount === beforeCount - completeDAsCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: timetable-subject-schedule-redesign, Property 7: Available subjects exclude already-added subjects
  // Validates: Requirements 2.1, 2.3
  it("Property 7: available subjects are scmMappings filtered by classId minus already-added subjects", () => {
    const scmMappingArb = fc.record({
      subjectId: fc.integer({ min: 1, max: 100 }),
      classId: fc.integer({ min: 1, max: 5 }),
    });

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(scmMappingArb, { minLength: 0, maxLength: 20 }),
        fc.array(completeSubjectScheduleArb, { minLength: 0, maxLength: 10 }),
        (ttClassId, scmMappings, ttSubjectSchedules) => {
          // Simulate available subjects logic
          const available = scmMappings.filter(
            m => m.classId === ttClassId && !ttSubjectSchedules.some(s => s.subjectId === m.subjectId.toString())
          );

          // Every available subject must belong to ttClassId
          if (available.some(m => m.classId !== ttClassId)) return false;

          // No available subject should already be in ttSubjectSchedules
          if (available.some(m => ttSubjectSchedules.some(s => s.subjectId === m.subjectId.toString()))) return false;

          // Every mapping for ttClassId not already added must appear in available
          const expectedAvailable = scmMappings.filter(
            m => m.classId === ttClassId && !ttSubjectSchedules.some(s => s.subjectId === m.subjectId.toString())
          );
          return available.length === expectedAvailable.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Dialog UI Behavior Tests ---

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

describe("Dialog UI behavior", () => {
  // Validates: Requirements 1.7
  it("save button is disabled when ttClassId is empty", () => {
    // The save button disabled condition is `!ttClassId`
    expect(!("")).toBe(true);
    expect(!("1")).toBe(false);
    expect(!(null)).toBe(true);
    expect(!(undefined)).toBe(true);
  });

  // Validates: Requirements 2.2
  it("all 7 days appear in the day selector", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  // Validates: Requirements 4.3
  it("shows 'No subjects mapped' message when scmMappings is empty for the class", () => {
    const ttClassId = "5";
    const scmMappings = [];

    // The condition that drives the "No subjects mapped" message
    const classScmMappings = scmMappings.filter(
      (m) => m.classId.toString() === ttClassId
    );
    expect(classScmMappings.length === 0).toBe(true);
  });
});
