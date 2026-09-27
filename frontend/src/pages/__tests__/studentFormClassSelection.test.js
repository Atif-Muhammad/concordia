import { describe, it, expect } from "vitest";

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") {
    return (val._id || val.id)?.toString() || "";
  }
  return val.toString();
};

function calculatePrefix({ classId, programId, programs = [], classes = [] }) {
  const cId = extractId(classId);
  const pId = extractId(programId);
  if (!cId || !Array.isArray(programs) || programs.length === 0) return "";
  const prog = programs.find((p) => extractId(p) === pId);
  const cls = Array.isArray(classes) ? classes.find((c) => extractId(c) === cId) : null;
  const pPrefix = prog?.rollPrefix || "";
  const cPrefix = cls?.rollPrefix || "";

  if (pPrefix && cPrefix && cPrefix.startsWith(pPrefix)) {
    return cPrefix;
  }
  return `${pPrefix}${cPrefix}`;
}

function computeRollNumberSuffix({ calculatedPrefix, prevPrefix, rollNumber }) {
  const rollStr = (rollNumber ?? "").toString();
  if (calculatedPrefix && rollStr.startsWith(calculatedPrefix)) {
    return rollStr.slice(calculatedPrefix.length);
  }
  if (prevPrefix && rollStr.startsWith(prevPrefix)) {
    return rollStr.slice(prevPrefix.length);
  }
  return rollStr;
}

function handleAutoRollNumber({
  calculatedPrefix,
  prevPrefix,
  isEditing,
  rollNumberMap,
  selectedYearSub,
  currentRollNumber,
  lastAutoRollNumber,
}) {
  const safeRollNumberMap = (rollNumberMap && typeof rollNumberMap === "object") ? rollNumberMap : {};
  if (!calculatedPrefix) return currentRollNumber;

  const cachedRoll = safeRollNumberMap[calculatedPrefix]
    || safeRollNumberMap[`${calculatedPrefix}${selectedYearSub}-`]
    || safeRollNumberMap[calculatedPrefix.replace(/-+$/, '')];

  if (calculatedPrefix !== prevPrefix || (!isEditing && cachedRoll)) {
    const rollStr = (currentRollNumber ?? "").toString();
    if (isEditing) {
      if (prevPrefix && rollStr.startsWith(prevPrefix)) {
        const numericPart = rollStr.slice(prevPrefix.length);
        return `${calculatedPrefix}${numericPart}`;
      } else if (!rollStr || rollStr === prevPrefix) {
        return calculatedPrefix;
      }
      return rollStr;
    } else {
      const nextRollNumber = cachedRoll?.nextSuffix?.startsWith(`${selectedYearSub}-`)
        ? (cachedRoll.nextRollNumber || `${calculatedPrefix}${cachedRoll.nextSuffix}`)
        : `${calculatedPrefix}${selectedYearSub}-001`;
      if (
        nextRollNumber !== rollStr &&
        (calculatedPrefix !== prevPrefix || !rollStr || rollStr === lastAutoRollNumber || rollStr === prevPrefix)
      ) {
        return nextRollNumber;
      }
      return rollStr;
    }
  }
  return currentRollNumber;
}

function findFeeStructureForClass(classId, clsObj, allFeeStructures = [], classes = [], selectedProgram = null) {
  if (!classId) return null;
  const cId = extractId(classId);
  const feeList = Array.isArray(allFeeStructures) ? allFeeStructures : [];

  const directMatch = feeList.find((fs) => {
    if (!fs) return false;
    const fsClassId = extractId(fs.classId || fs.class);
    return fsClassId === cId;
  });
  if (directMatch) return directMatch;

  const cls =
    clsObj ||
    (Array.isArray(classes) ? classes.find((c) => extractId(c) === cId) : null) ||
    (Array.isArray(selectedProgram?.classes) ? selectedProgram.classes.find((c) => extractId(c) === cId) : null);
  if (cls?.feeStructures && Array.isArray(cls.feeStructures) && cls.feeStructures.length > 0) {
    return cls.feeStructures[0];
  }
  return null;
}

describe("StudentForm Class Selection & Roll Number Robustness", () => {
  const mockPrograms = [
    { id: "prog-1", name: "FSc Pre-Medical", rollPrefix: "MED-" },
    { id: "prog-2", name: "ICS", rollPrefix: "ICS-" },
  ];

  const mockClasses = [
    {
      id: "cls-1",
      name: "1st Year Med",
      programId: "prog-1",
      rollPrefix: "1Y-",
      feeStructures: [{ id: "fs-1", totalAmount: 45000, installments: 3 }],
    },
    {
      id: "cls-2",
      name: "2nd Year Med",
      programId: "prog-1",
      rollPrefix: "MED-2Y-", // overlap test
      feeStructures: [{ id: "fs-2", totalAmount: 50000, installments: 2 }],
    },
  ];

  it("calculates correct prefix without throwing if programId is empty or invalid", () => {
    expect(() => calculatePrefix({ classId: "cls-1", programId: "", programs: mockPrograms, classes: mockClasses })).not.toThrow();
    expect(calculatePrefix({ classId: "cls-1", programId: "", programs: mockPrograms, classes: mockClasses })).toBe("1Y-");
  });

  it("calculates combined prefix correctly and handles overlapping prefixes", () => {
    const prefix1 = calculatePrefix({ classId: "cls-1", programId: "prog-1", programs: mockPrograms, classes: mockClasses });
    expect(prefix1).toBe("MED-1Y-");

    const prefix2 = calculatePrefix({ classId: "cls-2", programId: "prog-1", programs: mockPrograms, classes: mockClasses });
    expect(prefix2).toBe("MED-2Y-");
  });

  it("does not throw when rollNumberMap is null or undefined (e.g. from React Query data: null)", () => {
    expect(() =>
      handleAutoRollNumber({
        calculatedPrefix: "MED-1Y-",
        prevPrefix: "",
        isEditing: false,
        rollNumberMap: null,
        selectedYearSub: "26",
        currentRollNumber: "",
        lastAutoRollNumber: "",
      })
    ).not.toThrow();

    const roll = handleAutoRollNumber({
      calculatedPrefix: "MED-1Y-",
      prevPrefix: "",
      isEditing: false,
      rollNumberMap: null,
      selectedYearSub: "26",
      currentRollNumber: "",
      lastAutoRollNumber: "",
    });
    expect(roll).toBe("MED-1Y-26-001");
  });

  it("handles numeric roll numbers without throwing startsWith is not a function", () => {
    expect(() =>
      computeRollNumberSuffix({
        calculatedPrefix: "MED-1Y-",
        prevPrefix: "",
        rollNumber: 12345,
      })
    ).not.toThrow();

    const suffix = computeRollNumberSuffix({
      calculatedPrefix: "MED-1Y-",
      prevPrefix: "",
      rollNumber: 12345,
    });
    expect(suffix).toBe("12345");
  });

  it("updates roll number prefix properly in edit mode when class changes", () => {
    const updatedRoll = handleAutoRollNumber({
      calculatedPrefix: "MED-2Y-",
      prevPrefix: "MED-1Y-",
      isEditing: true,
      rollNumberMap: null,
      selectedYearSub: "26",
      currentRollNumber: "MED-1Y-26-015",
      lastAutoRollNumber: "",
    });
    expect(updatedRoll).toBe("MED-2Y-26-015");
  });

  it("finds fee structure from class or allFeeStructures properly", () => {
    const fee1 = findFeeStructureForClass("cls-1", mockClasses[0], [], mockClasses, mockPrograms[0]);
    expect(fee1).toBeDefined();
    expect(fee1.totalAmount).toBe(45000);
    expect(fee1.installments).toBe(3);

    const directFee = [{ classId: "cls-extra", totalAmount: 30000, installments: 1 }];
    const fee2 = findFeeStructureForClass("cls-extra", null, directFee, mockClasses, null);
    expect(fee2).toBeDefined();
    expect(fee2.totalAmount).toBe(30000);
  });

  it("handles missing fee structure without crashing", () => {
    const fee = findFeeStructureForClass("cls-nonexistent", null, null, [], null);
    expect(fee).toBeNull();
  });

  it("increments sequence from 26-001 to 26-002 for existing prefix in create mode", () => {
    const mockRollNumberMap = {
      "PSH-MED-FY": {
        latestRollNumber: "PSH-MED-FY26-001",
        yearSub: "26",
        maxSeq: 1,
        nextSuffix: "26-002",
        nextRollNumber: "PSH-MED-FY26-002",
      },
    };

    const nextRoll = handleAutoRollNumber({
      calculatedPrefix: "PSH-MED-FY",
      prevPrefix: "",
      isEditing: false,
      rollNumberMap: mockRollNumberMap,
      selectedYearSub: "26",
      currentRollNumber: "",
      lastAutoRollNumber: "",
    });

    expect(nextRoll).toBe("PSH-MED-FY26-002");
  });

  it("maintains separate prefix sequences (starts at 26-001 for empty prefix)", () => {
    const mockRollNumberMap = {
      "PSH-MED-FY": {
        latestRollNumber: "PSH-MED-FY26-001",
        yearSub: "26",
        maxSeq: 1,
        nextSuffix: "26-002",
        nextRollNumber: "PSH-MED-FY26-002",
      },
    };

    // For ICS prefix where no student exists yet
    const nextRoll = handleAutoRollNumber({
      calculatedPrefix: "PSH-ICS-FY",
      prevPrefix: "",
      isEditing: false,
      rollNumberMap: mockRollNumberMap,
      selectedYearSub: "26",
      currentRollNumber: "",
      lastAutoRollNumber: "",
    });

    expect(nextRoll).toBe("PSH-ICS-FY26-001");
  });

  it("matches prefix variant with trailing hyphen or yearSub key", () => {
    const mockRollNumberMap = {
      "PSH-MED-FY26-": {
        latestRollNumber: "PSH-MED-FY26-003",
        yearSub: "26",
        maxSeq: 3,
        nextSuffix: "26-004",
        nextRollNumber: "PSH-MED-FY26-004",
      },
    };

    const nextRoll = handleAutoRollNumber({
      calculatedPrefix: "PSH-MED-FY",
      prevPrefix: "",
      isEditing: false,
      rollNumberMap: mockRollNumberMap,
      selectedYearSub: "26",
      currentRollNumber: "",
      lastAutoRollNumber: "",
    });

    expect(nextRoll).toBe("PSH-MED-FY26-004");
  });
});
