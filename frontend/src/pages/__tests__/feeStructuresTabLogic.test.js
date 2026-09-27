import { describe, it, expect } from "vitest";

// Unit tests for fee structures linking, ID extraction, and filtering logic

const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return val.toString();
};

const cleanProgramName = (name) => {
  if (!name) return "";
  return name.replace(/\s*-\s*$/, "").trim();
};

const filterClassesByProgram = (classes, programs, selectedProgramId) => {
  if (!selectedProgramId) return [];
  return classes.filter((cls) => {
    const clsProgId = extractId(cls.programId);
    if (clsProgId && clsProgId === selectedProgramId) {
      return true;
    }
    const selectedProg = programs.find((p) => extractId(p) === selectedProgramId);
    if (selectedProg?.classes && Array.isArray(selectedProg.classes)) {
      return selectedProg.classes.some((c) => extractId(c) === extractId(cls));
    }
    return false;
  });
};

const buildFeeStructurePayload = (form) => {
  if (!form.programId || !form.classId || !form.totalAmount) {
    throw new Error("Please fill required fields");
  }

  const payload = {
    programId: form.programId,
    classId: form.classId,
    totalAmount: parseFloat(form.totalAmount),
    installments: parseInt(form.installments, 10) || 1,
  };

  if (isNaN(payload.totalAmount) || payload.totalAmount < 0) {
    throw new Error("Invalid total amount");
  }

  return payload;
};

const getEditFormData = (structure) => {
  return {
    programId: extractId(structure.programId || structure.program),
    classId: extractId(structure.classId || structure.class),
    totalAmount: structure.totalAmount !== undefined && structure.totalAmount !== null ? structure.totalAmount.toString() : "",
    installments: (structure.installments || 1).toString(),
  };
};

describe("FeeStructuresTab Logic and Program-Class Linking", () => {
  const samplePrograms = [
    { _id: "6501a1111111111111111111", name: "FSc Pre-Medical -", departmentId: { _id: "d1", name: "Science" } },
    { _id: "6501a2222222222222222222", name: "ICS - Computer Science", departmentId: { _id: "d2", name: "IT" } },
  ];

  const sampleClasses = [
    {
      _id: "6502b1111111111111111111",
      name: "11th Medical A",
      programId: { _id: "6501a1111111111111111111", name: "FSc Pre-Medical" },
    },
    {
      _id: "6502b2222222222222222222",
      name: "12th Medical A",
      programId: "6501a1111111111111111111", // unpopulated string ID
    },
    {
      _id: "6502b3333333333333333333",
      name: "11th ICS",
      programId: { _id: "6501a2222222222222222222", name: "ICS" },
    },
  ];

  it("cleans trailing dashes from program names", () => {
    expect(cleanProgramName("FSc Pre-Medical -")).toBe("FSc Pre-Medical");
    expect(cleanProgramName("ICS - Computer Science")).toBe("ICS - Computer Science");
    expect(cleanProgramName("Commerce - ")).toBe("Commerce");
    expect(cleanProgramName("")).toBe("");
  });

  it("extracts string ObjectId from populated object, plain string, or virtual id", () => {
    expect(extractId({ _id: "6501a1111111111111111111", name: "Test" })).toBe("6501a1111111111111111111");
    expect(extractId({ id: "6501a2222222222222222222", name: "Test" })).toBe("6501a2222222222222222222");
    expect(extractId("6501a3333333333333333333")).toBe("6501a3333333333333333333");
    expect(extractId(null)).toBe("");
  });

  it("filters classes correctly for selected program whether programId is populated or string ID", () => {
    const medClasses = filterClassesByProgram(sampleClasses, samplePrograms, "6501a1111111111111111111");
    expect(medClasses).toHaveLength(2);
    expect(medClasses.map(c => c.name)).toEqual(["11th Medical A", "12th Medical A"]);

    const icsClasses = filterClassesByProgram(sampleClasses, samplePrograms, "6501a2222222222222222222");
    expect(icsClasses).toHaveLength(1);
    expect(icsClasses[0].name).toBe("11th ICS");

    const noClasses = filterClassesByProgram(sampleClasses, samplePrograms, "");
    expect(noClasses).toEqual([]);
  });

  it("builds payload without parseInt corruption on 24-character ObjectIds", () => {
    const validForm = {
      programId: "6501a1111111111111111111",
      classId: "6502b1111111111111111111",
      totalAmount: "75000",
      installments: "3",
    };

    const payload = buildFeeStructurePayload(validForm);
    expect(payload.programId).toBe("6501a1111111111111111111");
    expect(typeof payload.programId).toBe("string");
    expect(payload.classId).toBe("6502b1111111111111111111");
    expect(typeof payload.classId).toBe("string");
    expect(payload.totalAmount).toBe(75000);
    expect(payload.installments).toBe(3);
  });

  it("throws validation error when required fields are missing", () => {
    expect(() => buildFeeStructurePayload({ programId: "", classId: "123", totalAmount: "100" }))
      .toThrow("Please fill required fields");
    expect(() => buildFeeStructurePayload({ programId: "123", classId: "", totalAmount: "100" }))
      .toThrow("Please fill required fields");
    expect(() => buildFeeStructurePayload({ programId: "123", classId: "456", totalAmount: "" }))
      .toThrow("Please fill required fields");
  });

  it("extracts edit form data properly without producing '[object Object]'", () => {
    const populatedStructure = {
      _id: "struct1",
      programId: { _id: "6501a1111111111111111111", name: "FSc Pre-Medical" },
      classId: { _id: "6502b1111111111111111111", name: "11th Medical A" },
      totalAmount: 60000,
      installments: 2,
    };

    const formData = getEditFormData(populatedStructure);
    expect(formData.programId).toBe("6501a1111111111111111111");
    expect(formData.programId).not.toContain("[object Object]");
    expect(formData.classId).toBe("6502b1111111111111111111");
    expect(formData.classId).not.toContain("[object Object]");
    expect(formData.totalAmount).toBe("60000");
    expect(formData.installments).toBe("2");
  });
});
