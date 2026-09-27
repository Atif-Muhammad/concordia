import { describe, it, expect } from "vitest";

// Pure helper reflecting StudentForm's classAllowsSections and availableSections logic
function determineClassAllowsSections(selectedClass) {
  if (!selectedClass) return false;
  return selectedClass.allowSections !== false;
}

function getAvailableSectionsForClass(classId, classAllowsSections, allSections) {
  if (!classId || !classAllowsSections) return [];
  return allSections.filter((sec) => {
    const cId =
      typeof sec.classId === "object" && sec.classId !== null
        ? (sec.classId._id || sec.classId.id)?.toString()
        : sec.classId?.toString();
    return cId === classId.toString();
  });
}

function validateStudentSection(sectionId, classAllowsSections) {
  if (!classAllowsSections) return "";
  if (!sectionId || sectionId === "none" || !sectionId.trim()) {
    return "Section is required";
  }
  return "";
}

describe("StudentForm - allowSections logic", () => {
  const mockClassWithSections = {
    id: "cls-1",
    name: "1st Year",
    allowSections: true,
  };

  const mockClassDefaultSections = {
    id: "cls-2",
    name: "2nd Year",
    // allowSections undefined (schema default true)
  };

  const mockClassNoSections = {
    id: "cls-3",
    name: "Short Course A",
    allowSections: false,
  };

  const mockSections = [
    { id: "sec-1", name: "Boys", classId: "cls-1" },
    { id: "sec-2", name: "Girls", classId: "cls-1" },
    { id: "sec-3", name: "Group A", classId: "cls-2" },
    { id: "sec-4", name: "Short Course Sec", classId: "cls-3" },
  ];

  describe("1. allowSections detection", () => {
    it("returns true when allowSections is explicitly true", () => {
      expect(determineClassAllowsSections(mockClassWithSections)).toBe(true);
    });

    it("returns true when allowSections is undefined (default true)", () => {
      expect(determineClassAllowsSections(mockClassDefaultSections)).toBe(true);
    });

    it("returns false when allowSections is false", () => {
      expect(determineClassAllowsSections(mockClassNoSections)).toBe(false);
    });

    it("returns false when no class is selected", () => {
      expect(determineClassAllowsSections(null)).toBe(false);
    });
  });

  describe("2. availableSections filtering", () => {
    it("returns matching sections when allowSections is true", () => {
      const allows = determineClassAllowsSections(mockClassWithSections);
      const available = getAvailableSectionsForClass("cls-1", allows, mockSections);
      expect(available).toHaveLength(2);
      expect(available.map((s) => s.name)).toEqual(["Boys", "Girls"]);
    });

    it("returns empty array when allowSections is false, disabling section selection", () => {
      const allows = determineClassAllowsSections(mockClassNoSections);
      const available = getAvailableSectionsForClass("cls-3", allows, mockSections);
      expect(available).toEqual([]);
    });

    it("returns empty array when no class is selected", () => {
      const available = getAvailableSectionsForClass("", false, mockSections);
      expect(available).toEqual([]);
    });
  });

  describe("3. Section validation", () => {
    it("requires a section when the selected class allows sections and none is selected", () => {
      const error = validateStudentSection("", true);
      expect(error).toBe("Section is required");
    });

    it("accepts valid sectionId when the selected class allows sections", () => {
      const error = validateStudentSection("sec-1", true);
      expect(error).toBe("");
    });

    it("rejects 'none' as sectionId when class allows sections", () => {
      const error = validateStudentSection("none", true);
      expect(error).toBe("Section is required");
    });

    it("does not require a section when the selected class does not allow sections", () => {
      const error = validateStudentSection("", false);
      expect(error).toBe("");
    });
  });
});
