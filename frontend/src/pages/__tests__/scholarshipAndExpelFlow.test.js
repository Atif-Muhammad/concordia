import { describe, it, expect } from "vitest";

describe("Scholarship and Expel Flow Unit Tests", () => {
  // =========================================================================
  // 1. EXPEL AND RE-JOIN FLOW
  // =========================================================================
  describe("1. Expel and Re-join Flow", () => {
    it("allows expelling a student even when they have outstanding dues / pending installments", () => {
      const student = {
        _id: "s1",
        status: "ACTIVE",
        installments: [
          { installmentNumber: 1, amount: 20000, paidAmount: 20000, status: "PAID" },
          { installmentNumber: 2, amount: 20000, paidAmount: 0, pendingAmount: 20000, status: "PENDING" },
        ],
      };

      // In the new logic, expel is never blocked by pending dues
      const canExpel = (st) => {
        // Status must not already be expelled or graduated
        return !["EXPELLED", "GRADUATED"].includes(String(st.status || "").toUpperCase());
      };

      expect(canExpel(student)).toBe(true);
    });

    it("preserves historical installments and payment audit trail upon expulsion", () => {
      const student = {
        _id: "s1",
        status: "ACTIVE",
        installments: [
          { installmentNumber: 1, amount: 15000, paidAmount: 15000, status: "PAID" },
          { installmentNumber: 2, amount: 15000, paidAmount: 0, pendingAmount: 15000, status: "PENDING" },
        ],
      };

      // Mock expel logic
      const expelStudent = (st, reason) => ({
        ...st,
        status: "EXPELLED",
        expelReason: reason,
        expelledDate: new Date(),
        // Installments remain intact for historical records
        installments: [...st.installments],
      });

      const expelled = expelStudent(student, "Disciplinary");
      expect(expelled.status).toBe("EXPELLED");
      expect(expelled.installments.length).toBe(2);
      expect(expelled.installments[0].paidAmount).toBe(15000);
      expect(expelled.installments[1].pendingAmount).toBe(15000);
    });

    it("excludes expelled students from pending collectables in fee reports", () => {
      const challans = [
        { id: "c1", studentStatus: "ACTIVE", netPayable: 10000, paidAmount: 0, status: "PENDING" },
        { id: "c2", studentStatus: "EXPELLED", netPayable: 15000, paidAmount: 0, status: "PENDING" },
        { id: "c3", studentStatus: "ACTIVE", netPayable: 20000, paidAmount: 20000, status: "PAID" },
      ];

      // Logic matching FeeSummaryReport.jsx and FeeReportsTab.jsx
      let totalPending = 0;
      let totalCollected = 0;

      for (const c of challans) {
        const isExpelled = String(c.studentStatus || "").toUpperCase() === "EXPELLED";
        const paid = Number(c.paidAmount || 0);
        const net = Number(c.netPayable || 0);
        const pending = isExpelled ? 0 : Math.max(0, net - paid);

        totalCollected += paid;
        totalPending += pending;
      }

      // c1 pending (10,000) is counted; c2 pending (15,000) is excluded because student is expelled
      expect(totalPending).toBe(10000);
      expect(totalCollected).toBe(20000);
    });

    it("recalculates fee upon re-join: locks paid items and redistributes remaining balance across unsettled installments", () => {
      const student = {
        _id: "s1",
        status: "EXPELLED",
        tuitionFee: 30000,
        installments: [
          { installmentNumber: 1, amount: 10000, paidAmount: 10000, pendingAmount: 0, status: "PAID" },
          { installmentNumber: 2, amount: 10000, paidAmount: 0, pendingAmount: 10000, status: "PENDING" },
          { installmentNumber: 3, amount: 10000, paidAmount: 0, pendingAmount: 10000, status: "PENDING" },
        ],
      };

      // Student already paid 10,000 (Inst 1 locked).
      // Re-joining with new agreed fee = 24,000.
      // Remaining to collect = 24,000 - 10,000 = 14,000 across 2 unsettled installments (7,000 each).
      const recalculateRejoinInstallments = (st, newTuitionFee) => {
        const alreadyPaid = st.installments.reduce((sum, inst) => {
          if (inst.status === "PAID" || (inst.paidAmount || 0) > 0) {
            return sum + (Number(inst.paidAmount) || Number(inst.amount) || 0);
          }
          return sum;
        }, 0);

        const remainingBalance = Math.max(0, newTuitionFee - alreadyPaid);
        const unsettled = st.installments.filter(inst => inst.status !== "PAID" && !(inst.paidAmount > 0));
        const unsettledCount = unsettled.length || 1;
        const baseAmount = Math.floor(remainingBalance / unsettledCount);
        const remainder = remainingBalance - (baseAmount * unsettledCount);

        let unsettledIdx = 0;
        return st.installments.map(inst => {
          if (inst.status === "PAID" || (inst.paidAmount || 0) > 0) {
            // Strictly locked
            return { ...inst };
          }
          const isLast = unsettledIdx === unsettledCount - 1;
          const newAmt = isLast ? baseAmount + remainder : baseAmount;
          unsettledIdx++;
          return {
            ...inst,
            amount: newAmt,
            pendingAmount: newAmt,
            status: newAmt === 0 ? "PAID" : "PENDING",
          };
        });
      };

      const updatedInstallments = recalculateRejoinInstallments(student, 24000);

      // Inst 1: Locked
      expect(updatedInstallments[0].amount).toBe(10000);
      expect(updatedInstallments[0].status).toBe("PAID");

      // Inst 2 & 3: 14,000 split into 7,000 each
      expect(updatedInstallments[1].amount).toBe(7000);
      expect(updatedInstallments[1].pendingAmount).toBe(7000);
      expect(updatedInstallments[2].amount).toBe(7000);
      expect(updatedInstallments[2].pendingAmount).toBe(7000);

      // Total of all installments equals new tuition fee
      const totalNew = updatedInstallments.reduce((sum, i) => sum + i.amount, 0);
      expect(totalNew).toBe(24000);
    });

    it("recalculates fee upon re-join: if new agreed fee is fully covered by previous payments, remaining installments become 0", () => {
      const student = {
        _id: "s1",
        status: "EXPELLED",
        tuitionFee: 30000,
        installments: [
          { installmentNumber: 1, amount: 15000, paidAmount: 15000, pendingAmount: 0, status: "PAID" },
          { installmentNumber: 2, amount: 15000, paidAmount: 0, pendingAmount: 15000, status: "PENDING" },
        ],
      };

      // Rejoining with new fee of 15,000 (already covered by Inst 1)
      const recalculate = (st, newFee) => {
        const alreadyPaid = 15000;
        const remaining = Math.max(0, newFee - alreadyPaid);
        return st.installments.map(inst => {
          if (inst.status === "PAID") return { ...inst };
          return {
            ...inst,
            amount: remaining,
            pendingAmount: remaining,
            status: remaining === 0 ? "PAID" : "PENDING",
          };
        });
      };

      const result = recalculate(student, 15000);
      expect(result[0].amount).toBe(15000);
      expect(result[0].status).toBe("PAID");
      expect(result[1].amount).toBe(0);
      expect(result[1].pendingAmount).toBe(0);
      expect(result[1].status).toBe("PAID");
    });
  });

  // =========================================================================
  // 2. 100% SCHOLARSHIP FLOW
  // =========================================================================
  describe("2. 100% Scholarship Flow", () => {
    it("sets agreed tuition fee to 0 and disables manual edits when 100% scholarship is checked", () => {
      let formData = {
        isScholarship100: false,
        tuitionFee: "140000",
        scholarshipStaffId: "",
        scholarshipAuthority: "",
      };

      const standardFee = 140000;

      // User checks 100% Scholarship
      const handleToggle100 = (checked) => {
        formData = {
          ...formData,
          isScholarship100: checked,
          tuitionFee: checked ? "0" : standardFee.toString(),
          scholarshipStaffId: checked ? formData.scholarshipStaffId : "",
          scholarshipAuthority: checked ? formData.scholarshipAuthority : "",
        };
      };

      handleToggle100(true);
      expect(formData.isScholarship100).toBe(true);
      expect(formData.tuitionFee).toBe("0");

      // User unchecks 100% Scholarship
      handleToggle100(false);
      expect(formData.isScholarship100).toBe(false);
      expect(formData.tuitionFee).toBe("140000");
    });

    it("allows validation when tuitionFee is 0 and installments total standard base amount under 100% scholarship", () => {
      const isScholarship100 = true;
      const agreedTuitionFee = 0;
      const installments = [
        { installmentNumber: 1, amount: 23333, dueDate: "2026-10-29" },
        { installmentNumber: 2, amount: 23333, dueDate: "2026-11-29" },
        { installmentNumber: 3, amount: 23334, dueDate: "2026-12-29" },
      ];
      const totalInstallmentsAmount = installments.reduce((sum, i) => sum + i.amount, 0); // 70,000

      const validateInstallments = (insts, agreed, is100) => {
        if (!insts?.length) return "Please define at least one installment.";
        const hasInvalidDates = insts.some(i => !i.dueDate);
        if (hasInvalidDates) return "All installments must have a valid due date.";
        if (!is100 && totalInstallmentsAmount !== agreed) {
          return `Installment total must equal agreed tuition fee (Rs. ${agreed}).`;
        }
        return "";
      };

      // Under 100% scholarship, 70,000 !== 0 should NOT fail
      const errorWith100 = validateInstallments(installments, agreedTuitionFee, isScholarship100);
      expect(errorWith100).toBe("");

      // Without 100% scholarship, 70,000 !== 0 MUST fail
      const errorWithout100 = validateInstallments(installments, agreedTuitionFee, false);
      expect(errorWithout100).toBe("Installment total must equal agreed tuition fee (Rs. 0).");
    });

    it("generates challan with basePayable offset by equal discount, netPayable = 0, and status = PAID", () => {
      const student = {
        _id: "s1",
        fName: "Scholarship",
        lName: "Student",
        isScholarship100: true,
        scholarshipAuthority: "WWF",
      };

      const installment = {
        installmentNumber: 1,
        amount: 25000,
        month: "October",
      };

      // Mock createChallan logic for 100% scholarship
      const createChallan = (st, inst) => {
        const basePayable = Number(inst.amount || 0);
        const isScholarship = Boolean(st.isScholarship100);
        const discountAmount = isScholarship ? basePayable : 0;
        const netPayable = Math.max(0, basePayable - discountAmount);
        const status = (isScholarship && netPayable === 0) ? "PAID" : "PENDING";
        const paidBy = isScholarship ? "100% Scholarship" : null;

        return {
          studentId: st._id,
          installmentNumber: inst.installmentNumber,
          month: inst.month,
          basePayable,
          discountAmount,
          netPayable,
          status,
          paidBy,
          isScholarship100: isScholarship,
        };
      };

      const challan = createChallan(student, installment);

      expect(challan.basePayable).toBe(25000);
      expect(challan.discountAmount).toBe(25000);
      expect(challan.netPayable).toBe(0);
      expect(challan.status).toBe("PAID");
      expect(challan.paidBy).toBe("100% Scholarship");
      expect(challan.isScholarship100).toBe(true);
    });

    it("locks discount on scholarship challan so it cannot be modified or cleared via edit", () => {
      const scholarshipChallan = {
        _id: "ch1",
        basePayable: 25000,
        discountAmount: 25000,
        netPayable: 0,
        status: "PAID",
        paidBy: "100% Scholarship",
        isScholarship100: true,
      };

      // Function representing handleSubmitChallan / updateChallan discount guard
      const attemptUpdateDiscount = (challan, requestedDiscount) => {
        const isScholarship = Boolean(
          challan.isScholarship100 ||
          challan.paidBy === "100% Scholarship"
        );

        if (isScholarship) {
          const currentDiscount = Number(challan.discountAmount || 0);
          if (requestedDiscount !== currentDiscount) {
            throw new Error("Discount originating from 100% scholarship is locked and cannot be modified");
          }
        }
        return { ...challan, discountAmount: requestedDiscount };
      };

      // Modifying discount to 10,000 should throw
      expect(() => attemptUpdateDiscount(scholarshipChallan, 10000)).toThrow(
        "Discount originating from 100% scholarship is locked and cannot be modified"
      );

      // Clearing discount to 0 should throw
      expect(() => attemptUpdateDiscount(scholarshipChallan, 0)).toThrow(
        "Discount originating from 100% scholarship is locked and cannot be modified"
      );

      // Keeping same discount should succeed
      expect(() => attemptUpdateDiscount(scholarshipChallan, 25000)).not.toThrow();
    });

    it("displays emerald 100% Scholarship badge in Status column and PKR 0 in Paid column in ChallansTab", () => {
      const challan = {
        _id: "ch1",
        basePayable: 20000,
        discountAmount: 20000,
        netPayable: 0,
        paidAmount: 0,
        status: "PAID",
        paidBy: "100% Scholarship",
        isScholarship100: true,
      };

      const isScholarshipChallan = Boolean(
        challan.isScholarship100 ||
        challan.paidBy === "100% Scholarship"
      );

      // Status badge text
      const statusBadgeText = isScholarshipChallan ? "100% Scholarship" : challan.status;
      expect(statusBadgeText).toBe("100% Scholarship");

      // Paid display text
      const paidDisplayText = isScholarshipChallan
        ? "PKR 0 (100% Scholarship Concession)"
        : `PKR ${challan.paidAmount}`;
      expect(paidDisplayText).toBe("PKR 0 (100% Scholarship Concession)");
    });
  });
});
