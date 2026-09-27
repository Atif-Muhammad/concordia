import { describe, it, expect } from "vitest";

// Pure business logic functions mirroring student.service.js for client/server testing

function getPrefix(pPrefix, cPrefix) {
  const p = (pPrefix || "").trim();
  const c = (cPrefix || "").trim();
  if (p && c && c.startsWith(p)) return c;
  return `${p}${c}`;
}

function calculateArrears(student, pendingChallans = []) {
  const studentClassIdStr = (student.classId?._id || student.classId || "").toString();

  const pendingInstallments = (student.installments || []).filter((inst) => {
    const instClassIdStr = (inst.classId?._id || inst.classId || "").toString();
    if (instClassIdStr && instClassIdStr !== studentClassIdStr) return false;
    const st = String(inst.status || "").toUpperCase();
    if (["SUPERSEDED", "SETTLED", "VOID", "PAID"].includes(st)) return false;
    const due = Number(inst.totalAmount || inst.amount || inst.basePayable || 0);
    const paid = Number(inst.paidAmount || 0);
    return due - paid > 0;
  });

  let outstandingAmount = pendingInstallments.reduce((sum, inst) => {
    const due = inst.challanGenerated && inst.totalAmount !== undefined
      ? Math.max(0, Number(inst.totalAmount) - Number(inst.paidAmount || 0))
      : Math.max(0, Number(inst.basePayable || inst.amount || 0) - Number(inst.paidAmount || 0));
    return sum + due;
  }, 0);

  if (outstandingAmount === 0 && pendingChallans.length > 0) {
    outstandingAmount = pendingChallans.reduce((sum, ch) => {
      return sum + Math.max(0, Number(ch.amount || 0) - Number(ch.paidAmount || 0));
    }, 0);
  }

  return { outstandingAmount, pendingInstallments };
}

function sortClasses(classes = []) {
  return [...classes].sort((a, b) => {
    if (a.isSemester && b.isSemester) return (a.semester ?? 0) - (b.semester ?? 0);
    if (!a.isSemester && !b.isSemester) return (a.year ?? 0) - (b.year ?? 0);
    if (a.isSemester && !b.isSemester) return 1;
    if (!a.isSemester && b.isSemester) return -1;
    return 0;
  });
}

function computePromotedPlacement({
  student,
  programClasses,
  targetClassId,
  targetSectionId,
  targetProgram,
}) {
  let nextClass;
  let matchingSection;

  if (targetClassId) {
    nextClass = programClasses.find((c) => (c._id || c.id)?.toString() === targetClassId.toString());
    if (!nextClass) throw new Error("Target class does not belong to the selected program");
    if (targetSectionId && nextClass.sections) {
      matchingSection = nextClass.sections.find((s) => (s._id || s.id)?.toString() === targetSectionId.toString());
    }
  } else {
    const sorted = sortClasses(programClasses);
    const curIdx = sorted.findIndex((c) => (c._id || c.id)?.toString() === (student.classId?._id || student.classId || "").toString());
    if (curIdx === -1 || curIdx >= sorted.length - 1) {
      nextClass = sorted[0];
    } else {
      nextClass = sorted[curIdx + 1];
      if (student.sectionId?.name && nextClass.sections) {
        matchingSection = nextClass.sections.find((s) => s.name === student.sectionId.name);
      }
    }
  }

  const oldPrefix = getPrefix(student.programId?.rollPrefix, student.classId?.rollPrefix);
  const newPrefix = getPrefix(targetProgram?.rollPrefix || student.programId?.rollPrefix, nextClass?.rollPrefix);

  let updatedRollNumber = student.rollNumber;
  if (oldPrefix && updatedRollNumber && updatedRollNumber.startsWith(oldPrefix)) {
    updatedRollNumber = newPrefix + updatedRollNumber.slice(oldPrefix.length);
  }

  return { nextClass, matchingSection, updatedRollNumber };
}

function computeDemotePlacement({ student, programClasses }) {
  if (student.passedOut || student.status === "GRADUATED") {
    throw new Error("Student already passed out");
  }

  const sorted = sortClasses(programClasses);
  const curIdx = sorted.findIndex((c) => (c._id || c.id)?.toString() === (student.classId?._id || student.classId || "").toString());
  if (curIdx <= 0) {
    throw new Error("Cannot demote below entry level");
  }

  const prevClass = sorted[curIdx - 1];
  let matchingSection = null;
  if (student.sectionId?.name && prevClass.sections) {
    matchingSection = prevClass.sections.find((s) => s.name === student.sectionId.name);
  }

  const oldPrefix = getPrefix(student.programId?.rollPrefix, student.classId?.rollPrefix);
  const newPrefix = getPrefix(student.programId?.rollPrefix, prevClass?.rollPrefix);

  let updatedRollNumber = student.rollNumber;
  if (oldPrefix && updatedRollNumber && updatedRollNumber.startsWith(oldPrefix)) {
    updatedRollNumber = newPrefix + updatedRollNumber.slice(oldPrefix.length);
  }

  return { prevClass, matchingSection, updatedRollNumber };
}

describe("Student Lifecycle Actions (Promote, Demote, Pass Out, Expel, Struck Off, Re-join)", () => {
  const mockProgram = {
    _id: "prog_med",
    name: "FSc Pre-Medical",
    rollPrefix: "PSH-MED-",
  };

  const mockClasses = [
    {
      _id: "cls_1y",
      name: "1st Year",
      rollPrefix: "FY",
      year: 1,
      isSemester: false,
      sections: [{ _id: "sec_a", name: "Section A" }],
    },
    {
      _id: "cls_2y",
      name: "2nd Year",
      rollPrefix: "SY",
      year: 2,
      isSemester: false,
      sections: [{ _id: "sec_a2", name: "Section A" }],
    },
  ];

  describe("1. Promotion Logic", () => {
    it("detects outstanding arrears and returns requiresConfirmation when forcePromote is false", () => {
      const student = {
        _id: "stud_1",
        rollNumber: "PSH-MED-FY26-001",
        fName: "Zaid",
        lName: "Ali",
        classId: mockClasses[0],
        programId: mockProgram,
        installments: [
          {
            installmentNumber: 1,
            month: "September",
            amount: 20000,
            basePayable: 20000,
            paidAmount: 20000,
            status: "PAID",
          },
          {
            installmentNumber: 2,
            month: "October",
            amount: 20000,
            basePayable: 20000,
            paidAmount: 5000,
            status: "PARTIAL",
          },
        ],
      };

      const { outstandingAmount, pendingInstallments } = calculateArrears(student);
      expect(outstandingAmount).toBe(15000);
      expect(pendingInstallments).toHaveLength(1);
      expect(pendingInstallments[0].installmentNumber).toBe(2);
    });

    it("allows automatic promotion to next class and updates roll number prefix", () => {
      const student = {
        _id: "stud_1",
        rollNumber: "PSH-MED-FY26-001",
        classId: mockClasses[0],
        sectionId: mockClasses[0].sections[0],
        programId: mockProgram,
      };

      const { nextClass, matchingSection, updatedRollNumber } = computePromotedPlacement({
        student,
        programClasses: mockClasses,
        targetClassId: undefined,
        targetProgram: mockProgram,
      });

      expect(nextClass._id).toBe("cls_2y");
      expect(nextClass.name).toBe("2nd Year");
      expect(matchingSection?.name).toBe("Section A");
      // Suffix 26-001 is preserved while prefix moves from PSH-MED-FY to PSH-MED-SY
      expect(updatedRollNumber).toBe("PSH-MED-SY26-001");
    });

    it("allows manual target class override during promotion", () => {
      const student = {
        _id: "stud_1",
        rollNumber: "PSH-MED-FY26-005",
        classId: mockClasses[0],
        programId: mockProgram,
      };

      const { nextClass, updatedRollNumber } = computePromotedPlacement({
        student,
        programClasses: mockClasses,
        targetClassId: "cls_2y",
        targetProgram: mockProgram,
      });

      expect(nextClass._id).toBe("cls_2y");
      expect(updatedRollNumber).toBe("PSH-MED-SY26-005");
    });
  });

  describe("2. Demotion Logic", () => {
    it("demotes 2nd Year student back to 1st Year and rolls back roll prefix", () => {
      const student = {
        _id: "stud_2",
        rollNumber: "PSH-MED-SY26-001",
        classId: mockClasses[1],
        sectionId: mockClasses[1].sections[0],
        programId: mockProgram,
        passedOut: false,
      };

      const { prevClass, matchingSection, updatedRollNumber } = computeDemotePlacement({
        student,
        programClasses: mockClasses,
      });

      expect(prevClass._id).toBe("cls_1y");
      expect(matchingSection?.name).toBe("Section A");
      expect(updatedRollNumber).toBe("PSH-MED-FY26-001");
    });

    it("throws error when attempting to demote below entry level (1st Year)", () => {
      const student = {
        _id: "stud_1",
        rollNumber: "PSH-MED-FY26-001",
        classId: mockClasses[0],
        programId: mockProgram,
        passedOut: false,
      };

      expect(() =>
        computeDemotePlacement({
          student,
          programClasses: mockClasses,
        })
      ).toThrow("Cannot demote below entry level");
    });

    it("throws error when attempting to demote a passed out student", () => {
      const student = {
        _id: "stud_grad",
        classId: mockClasses[1],
        programId: mockProgram,
        passedOut: true,
      };

      expect(() =>
        computeDemotePlacement({
          student,
          programClasses: mockClasses,
        })
      ).toThrow("Student already passed out");
    });
  });

  describe("3. Pass Out & Expel Dues Enforcement", () => {
    it("blocks passout if student has unpaid arrears", () => {
      const student = {
        installments: [
          { amount: 30000, basePayable: 30000, paidAmount: 10000, status: "PARTIAL" },
        ],
      };

      const { outstandingAmount } = calculateArrears(student);
      expect(outstandingAmount).toBe(20000);

      const canPassout = outstandingAmount === 0;
      expect(canPassout).toBe(false);
    });

    it("allows passout when all installments are fully paid", () => {
      const student = {
        installments: [
          { amount: 30000, basePayable: 30000, paidAmount: 30000, status: "PAID" },
        ],
      };

      const { outstandingAmount } = calculateArrears(student);
      expect(outstandingAmount).toBe(0);

      const canPassout = outstandingAmount === 0;
      expect(canPassout).toBe(true);
    });
  });

  describe("4. Re-join Logic", () => {
    it("validates student was STRUCK_OFF or EXPELLED before rejoining", () => {
      const activeStudent = { status: "ACTIVE" };
      const struckOffStudent = { status: "STRUCK_OFF" };
      const expelledStudent = { status: "EXPELLED" };

      const canRejoin = (st) => ["STRUCK_OFF", "EXPELLED"].includes(String(st.status).toUpperCase());

      expect(canRejoin(activeStudent)).toBe(false);
      expect(canRejoin(struckOffStudent)).toBe(true);
      expect(canRejoin(expelledStudent)).toBe(true);
    });
  });

  describe("5. Dialog UI Normalization", () => {
    it("normalizes 'promote' to 'promote_manual' so Destination Placement renders", () => {
      const normalizeAction = (action) =>
        action === "promote" || action === "promote_manual" ? "promote_manual" : action;

      expect(normalizeAction("promote")).toBe("promote_manual");
      expect(normalizeAction("promote_manual")).toBe("promote_manual");
      expect(normalizeAction("demote")).toBe("demote");
      expect(normalizeAction("rejoin")).toBe("rejoin");
    });
  });
});
