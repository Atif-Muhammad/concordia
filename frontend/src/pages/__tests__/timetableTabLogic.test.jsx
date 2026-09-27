import { describe, it, expect } from "vitest";

// Pure logic functions mirroring TimetableTab.jsx
const resolveId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return (item.id || item._id || "").toString();
  }
  return item.toString();
};

const filterClassesByProgram = (classes, programId) => {
  if (!programId || programId === "all") return classes;
  return classes.filter((c) => resolveId(c.programId) === programId);
};

const filterSectionsByClass = (sections, classId, allowSections) => {
  if (!classId || classId === "all" || allowSections === false) return [];
  return sections.filter((s) => resolveId(s.classId) === classId);
};

const checkClassAllowsSections = (selectedClass) => {
  if (!selectedClass) return false;
  return selectedClass.allowSections !== false;
};

const groupSlotsToSchedules = (slots) => {
  const map = new Map();
  for (const s of slots) {
    const key = resolveId(s.subjectId);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        teacherId: resolveId(s.teacherId),
        dayAssignments: [],
      });
    }
    const entry = map.get(key);
    if (!entry.teacherId && s.teacherId) {
      entry.teacherId = resolveId(s.teacherId);
    }
    entry.dayAssignments.push({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      teacherId: resolveId(s.teacherId) || entry.teacherId || "",
    });
  }
  return Array.from(map.entries()).map(([subjectId, data]) => ({
    subjectId,
    teacherId: data.teacherId || "",
    dayAssignments: data.dayAssignments,
  }));
};

const flattenSchedulesToSlots = (schedules) => {
  const result = [];
  for (const sched of schedules) {
    if (!sched.subjectId) continue;
    for (const da of sched.dayAssignments) {
      if (!da.dayOfWeek || !da.startTime || !da.endTime) continue;
      result.push({
        dayOfWeek: da.dayOfWeek,
        startTime: da.startTime,
        endTime: da.endTime,
        subjectId: resolveId(sched.subjectId),
        teacherId: resolveId(da.teacherId || sched.teacherId) || null,
      });
    }
  }
  return result;
};

const validateTimetableSave = ({
  classId,
  sectionId,
  classAllowsSections,
  schedules,
}) => {
  if (!classId) return { valid: false, error: "Please select a class" };
  if (classAllowsSections && !sectionId) {
    return { valid: false, error: "Please select a section for this class" };
  }
  const slots = flattenSchedulesToSlots(schedules);
  if (slots.length === 0) {
    return { valid: false, error: "Please configure at least one period with a valid day, start time, and end time" };
  }
  return { valid: true, slots };
};

describe("TimetableTab Logic, Filters, and allowSections", () => {
  const mockPrograms = [
    { id: "prog-1", name: "FSc Pre-Medical" },
    { id: "prog-2", name: "BS Computer Science" },
  ];

  const mockClasses = [
    { id: "cls-1", name: "1st year Pre-Med", programId: "prog-1", allowSections: true },
    { id: "cls-2", name: "2nd year Pre-Med", programId: "prog-1", allowSections: true },
    { id: "cls-3", name: "Semester 1", programId: "prog-2", allowSections: false },
  ];

  const mockSections = [
    { id: "sec-1", name: "Section A", classId: "cls-1" },
    { id: "sec-2", name: "Section B", classId: "cls-1" },
    { id: "sec-3", name: "Section A", classId: "cls-2" },
  ];

  describe("1. Program -> Class Cascading Filter", () => {
    it("returns all classes when program filter is 'all'", () => {
      const filtered = filterClassesByProgram(mockClasses, "all");
      expect(filtered).toHaveLength(3);
    });

    it("filters classes when specific program is selected", () => {
      const filtered = filterClassesByProgram(mockClasses, "prog-1");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((c) => c.id)).toEqual(["cls-1", "cls-2"]);
    });

    it("filters classes for BS program", () => {
      const filtered = filterClassesByProgram(mockClasses, "prog-2");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("cls-3");
    });
  });

  describe("2. allowSections and Section Filter", () => {
    it("returns sections for a class that allows sections", () => {
      const sectionsForCls1 = filterSectionsByClass(mockSections, "cls-1", true);
      expect(sectionsForCls1).toHaveLength(2);
    });

    it("returns empty array for a class that does NOT allow sections", () => {
      const sectionsForCls3 = filterSectionsByClass(mockSections, "cls-3", false);
      expect(sectionsForCls3).toHaveLength(0);
    });

    it("checkClassAllowsSections returns false for allowSections === false", () => {
      expect(checkClassAllowsSections(mockClasses[2])).toBe(false);
      expect(checkClassAllowsSections(mockClasses[0])).toBe(true);
    });
  });

  describe("3. Timetable Save Validation with allowSections", () => {
    const validSchedules = [
      {
        subjectId: "sub-101",
        teacherId: "teacher-1",
        dayAssignments: [
          { dayOfWeek: "Monday", startTime: "09:00", endTime: "10:00", teacherId: "teacher-1" },
        ],
      },
    ];

    it("fails when class allows sections and sectionId is missing", () => {
      const res = validateTimetableSave({
        classId: "cls-1",
        sectionId: "",
        classAllowsSections: true,
        schedules: validSchedules,
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Please select a section for this class");
    });

    it("succeeds when class allows sections and sectionId is provided", () => {
      const res = validateTimetableSave({
        classId: "cls-1",
        sectionId: "sec-1",
        classAllowsSections: true,
        schedules: validSchedules,
      });
      expect(res.valid).toBe(true);
      expect(res.slots).toHaveLength(1);
      expect(res.slots[0].teacherId).toBe("teacher-1");
    });

    it("succeeds when class does NOT allow sections even without sectionId", () => {
      const res = validateTimetableSave({
        classId: "cls-3",
        sectionId: "",
        classAllowsSections: false,
        schedules: validSchedules,
      });
      expect(res.valid).toBe(true);
      expect(res.slots).toHaveLength(1);
    });

    it("fails when no periods are configured", () => {
      const res = validateTimetableSave({
        classId: "cls-3",
        sectionId: "",
        classAllowsSections: false,
        schedules: [
          {
            subjectId: "sub-101",
            teacherId: "teacher-1",
            dayAssignments: [
              { dayOfWeek: "Monday", startTime: "", endTime: "" },
            ],
          },
        ],
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("at least one period");
    });
  });

  describe("4. Common Teachers and Grouping/Flattening Slots", () => {
    it("preserves teacherId when flattening and grouping slots", () => {
      const initialSchedules = [
        {
          subjectId: "sub-1",
          teacherId: "teacher-A",
          dayAssignments: [
            { dayOfWeek: "Monday", startTime: "08:30", endTime: "09:30", teacherId: "teacher-A" },
            { dayOfWeek: "Wednesday", startTime: "10:00", endTime: "11:00", teacherId: "teacher-B" },
          ],
        },
      ];

      const slots = flattenSchedulesToSlots(initialSchedules);
      expect(slots).toHaveLength(2);
      expect(slots[0]).toEqual({
        dayOfWeek: "Monday",
        startTime: "08:30",
        endTime: "09:30",
        subjectId: "sub-1",
        teacherId: "teacher-A",
      });
      expect(slots[1]).toEqual({
        dayOfWeek: "Wednesday",
        startTime: "10:00",
        endTime: "11:00",
        subjectId: "sub-1",
        teacherId: "teacher-B",
      });

      const regrouped = groupSlotsToSchedules(slots);
      expect(regrouped).toHaveLength(1);
      expect(regrouped[0].subjectId).toBe("sub-1");
      expect(regrouped[0].dayAssignments).toHaveLength(2);
    });

    it("handles MongoDB ObjectId strings without NaN", () => {
      const objectIdSlots = [
        {
          subjectId: "650a8c9e0123456789abcdef",
          teacherId: "650a8c9e0123456789abcde0",
          dayOfWeek: "Friday",
          startTime: "11:00",
          endTime: "12:00",
        },
      ];

      const grouped = groupSlotsToSchedules(objectIdSlots);
      expect(grouped[0].subjectId).toBe("650a8c9e0123456789abcdef");
      expect(grouped[0].teacherId).toBe("650a8c9e0123456789abcde0");

      const flattened = flattenSchedulesToSlots(grouped);
      expect(flattened[0].subjectId).toBe("650a8c9e0123456789abcdef");
      expect(flattened[0].teacherId).toBe("650a8c9e0123456789abcde0");
    });
  });
});
