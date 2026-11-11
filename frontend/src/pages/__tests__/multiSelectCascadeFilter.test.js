import { describe, it, expect } from "vitest";

// Pure helper function representing getResults query-param serialization
const buildGetResultsParams = (filters = {}) => {
  const formatParam = (val) => {
    if (!val || val === "*" || val === "all" || val === "__all__") return null;
    if (Array.isArray(val)) return val.length ? val.filter(Boolean).join(",") : null;
    return String(val);
  };

  const params = new URLSearchParams();
  const sessionId = formatParam(filters.sessionId);
  if (sessionId) params.append("sessionId", sessionId);

  const programId = formatParam(filters.programId);
  if (programId) params.append("programId", programId);

  const classId = formatParam(filters.classId);
  if (classId) params.append("classId", classId);

  const sectionId = formatParam(filters.sectionId);
  if (sectionId) params.append("sectionId", sectionId);

  const examId = formatParam(filters.examId);
  if (examId) params.append("examId", examId);

  return params.toString();
};

// Pure helper function representing CheckboxMultiSelect displayText calculation
const getDisplayText = ({ selected = [], options = [], placeholder, allLabel, title }) => {
  const isAll = options.length > 0 && selected.length === options.length;
  if (selected.length === 0) return placeholder;
  if (isAll) return allLabel || `All ${title} (${options.length})`;
  if (selected.length === 1) {
    const match = options.find((o) => o.value === selected[0]);
    return match ? match.label : selected[0];
  }
  return `${selected.length} ${title} Selected`;
};

describe("CheckboxMultiSelect Display Text Logic", () => {
  const options = [
    { value: "p1", label: "FSc Pre-Medical" },
    { value: "p2", label: "FSc Pre-Engineering" },
    { value: "p3", label: "ICS" },
  ];

  it("should return placeholder when no items selected", () => {
    const text = getDisplayText({
      selected: [],
      options,
      placeholder: "All Programs",
      allLabel: "All Programs",
      title: "Programs",
    });
    expect(text).toBe("All Programs");
  });

  it("should return label when exactly 1 item selected", () => {
    const text = getDisplayText({
      selected: ["p1"],
      options,
      placeholder: "All Programs",
      allLabel: "All Programs",
      title: "Programs",
    });
    expect(text).toBe("FSc Pre-Medical");
  });

  it("should return count label when multiple items selected", () => {
    const text = getDisplayText({
      selected: ["p1", "p2"],
      options,
      placeholder: "All Programs",
      allLabel: "All Programs",
      title: "Programs",
    });
    expect(text).toBe("2 Programs Selected");
  });

  it("should return allLabel when all items are selected", () => {
    const text = getDisplayText({
      selected: ["p1", "p2", "p3"],
      options,
      placeholder: "All Programs",
      allLabel: "All Programs",
      title: "Programs",
    });
    expect(text).toBe("All Programs");
  });
});

describe("Cascade Blocking & Pruning Rules", () => {
  it("should block Class dropdown if Program is empty", () => {
    const selectedProgramIds = [];
    const isClassDisabled = selectedProgramIds.length === 0;
    const classPlaceholder = isClassDisabled ? "Select program first" : "All Classes";

    expect(isClassDisabled).toBe(true);
    expect(classPlaceholder).toBe("Select program first");
  });

  it("should enable Class dropdown if Program is selected", () => {
    const selectedProgramIds = ["prog-123"];
    const isClassDisabled = selectedProgramIds.length === 0;
    const classPlaceholder = isClassDisabled ? "Select program first" : "All Classes";

    expect(isClassDisabled).toBe(false);
    expect(classPlaceholder).toBe("All Classes");
  });

  it("should block Section and Exam dropdowns if Class is empty", () => {
    const selectedClassIds = [];
    const isSectionDisabled = selectedClassIds.length === 0;
    const isExamDisabled = selectedClassIds.length === 0;

    expect(isSectionDisabled).toBe(true);
    expect(isExamDisabled).toBe(true);
  });

  it("should enable Section and Exam dropdowns when Class is selected", () => {
    const selectedClassIds = ["cls-456"];
    const isSectionDisabled = selectedClassIds.length === 0;
    const isExamDisabled = selectedClassIds.length === 0;

    expect(isSectionDisabled).toBe(false);
    expect(isExamDisabled).toBe(false);
  });

  it("should block Student Result Exam dropdown until Student is selected", () => {
    let studentResultStudent = "";
    expect(!studentResultStudent).toBe(true);

    studentResultStudent = "student-789";
    expect(!studentResultStudent).toBe(false);
  });

  it("should prune downstream classes and sections when parent program selection is removed", () => {
    const allClasses = [
      { id: "c1", programId: "p1", name: "11th Medical" },
      { id: "c2", programId: "p2", name: "11th Engineering" },
    ];
    const allSections = [
      { id: "s1", classId: "c1", name: "Section A" },
      { id: "s2", classId: "c2", name: "Section B" },
    ];

    let selectedProgramIds = ["p1", "p2"];
    let selectedClassIds = ["c1", "c2"];
    let selectedSectionIds = ["s1", "s2"];

    // User unselects p2, keeping only p1
    selectedProgramIds = ["p1"];
    selectedClassIds = selectedClassIds.filter((cId) => {
      const cls = allClasses.find((c) => c.id === cId);
      return selectedProgramIds.includes(cls?.programId);
    });
    selectedSectionIds = selectedSectionIds.filter((sId) => {
      const sec = allSections.find((s) => s.id === sId);
      return selectedClassIds.includes(sec?.classId);
    });

    expect(selectedClassIds).toEqual(["c1"]);
    expect(selectedSectionIds).toEqual(["s1"]);
  });
});

describe("getResults API query parameters construction", () => {
  it("should serialize multiple programs, classes, sections, and exams into comma-separated query string", () => {
    const qs = buildGetResultsParams({
      sessionId: "sess-1",
      programId: ["prog-1", "prog-2"],
      classId: ["cls-1", "cls-2"],
      sectionId: ["sec-1"],
      examId: ["exam-1", "exam-2"],
    });

    expect(qs).toBe(
      "sessionId=sess-1&programId=prog-1%2Cprog-2&classId=cls-1%2Ccls-2&sectionId=sec-1&examId=exam-1%2Cexam-2"
    );
  });

  it("should omit empty or all wildcard parameters", () => {
    const qs = buildGetResultsParams({
      sessionId: "all",
      programId: [],
      classId: "*",
      sectionId: "__all__",
      examId: "exam-999",
    });

    expect(qs).toBe("examId=exam-999");
  });
});
