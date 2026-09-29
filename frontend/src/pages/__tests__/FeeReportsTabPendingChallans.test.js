import { describe, it, expect } from "vitest";
import {
  normalizeChallan,
  getChallanGrossTotal,
  calculateLateFee,
} from "../fee-management/feeFinancialUtils";

describe("FeeReportsTab pending challans grouping and aggregation", () => {
  const calculateChallanFinancials = (rawChallan, lateFeeRatePerDay = 0) => {
    const c = normalizeChallan(rawChallan);
    if (!c) return null;

    const isSettledOrVoid = ['PAID', 'VOID', 'SUPERSEDED', 'SETTLED'].includes(c.status);
    const existingFine = Number(c.snapshotLateFee ?? c.lateFeeAmount ?? c.lateFeeFine ?? c.fineAmount ?? 0);
    const effectiveRate = Number(
      c.installment?.lateFeeRatePerDay ??
      c.lateFeeRatePerDay ??
      lateFeeRatePerDay ??
      0
    );
    const autoFine = (!isSettledOrVoid && c.dueDate && effectiveRate > 0)
      ? calculateLateFee(c.dueDate, effectiveRate)
      : 0;
    const effectiveFine = existingFine > 0 ? existingFine : autoFine;

    const grossTotal = getChallanGrossTotal(c);
    const fineIncluded = existingFine > 0 && Number(c.lateFeeAmount || c.snapshotLateFee || 0) > 0;
    const totalAmount = fineIncluded ? grossTotal : (grossTotal + effectiveFine);

    const advanceApplied = Number(c.advanceApplied || c.advanceAmount || 0);
    const directPaid = Number(c.directPaidAmount ?? c.paidAmount ?? 0);
    const settledArrears = Number(c.settledViaArrearsAmount ?? c.settledAmount ?? 0);
    const isSettled = c.status === 'SETTLED';

    const totalPaid = directPaid + advanceApplied + (isSettled ? settledArrears : 0);
    const pendingAmount = isSettled ? 0 : Math.max(0, totalAmount - advanceApplied - directPaid);

    return {
      ...c,
      effectiveFine,
      totalAmount,
      paidAmount: totalPaid,
      pendingAmount,
    };
  };

  const aggregateStudentPendingReports = (challanItems, searchQuery = "", lateFeeRatePerDay = 0) => {
    const studentsMap = new Map();

    for (const raw of challanItems) {
      const c = calculateChallanFinancials(raw, lateFeeRatePerDay);
      if (!c) continue;
      if (['VOID', 'SUPERSEDED', 'SETTLED'].includes(c.status)) continue;

      if (c.pendingAmount <= 0) continue;

      const sId = c.studentId || c.student?._id || c.rollNumber;
      if (!sId) continue;

      if (!studentsMap.has(sId)) {
        const progName = c.studentProgram || '';
        const clsName = c.studentClass || '';
        const secName = c.studentSection || '';
        const pcs = [progName, clsName, secName].filter(Boolean).join(' / ') || '-';

        studentsMap.set(sId, {
          id: sId,
          studentName: c.studentName,
          fatherName: c.fatherName,
          rollNumber: c.rollNumber,
          programClassSection: pcs,
          pendingChallans: [],
          totalPaid: 0,
          totalPending: 0,
          totalAmount: 0,
        });
      }

      const entry = studentsMap.get(sId);
      entry.pendingChallans.push({
        id: c.id || c.challanNo,
        challanNo: c.challanNo,
        month: c.month,
        installmentNumber: c.installmentNumber,
        totalAmount: c.totalAmount,
        paidAmount: c.paidAmount,
        pendingAmount: c.pendingAmount,
        status: c.status || 'PENDING',
      });
      entry.totalPaid += c.paidAmount;
      entry.totalPending += c.pendingAmount;
      entry.totalAmount += c.totalAmount;
    }

    let list = Array.from(studentsMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q)
      );
    }
    return list;
  };

  it("correctly includes late fee fines for overdue challans matching Image 2", () => {
    // In Image 2, Challan 65090782 has base 10000 and 3000 late fee fine -> total 13000
    const rawChallans = [
      {
        studentId: "s_test",
        studentName: "test",
        fatherName: "father",
        rollNumber: "PSH-CS-I26-002",
        challanNo: "65090782",
        month: "September",
        installmentNumber: 1,
        amount: 10000,
        basePayable: 10000,
        snapshotLateFee: 3000,
        lateFeeAmount: 3000,
        paidAmount: 0,
        status: "PENDING",
      },
      {
        studentId: "s_test_student",
        studentName: "test student",
        fatherName: "father name",
        rollNumber: "PSH-CS-I26-001",
        challanNo: "63932264",
        month: "December",
        installmentNumber: 4,
        amount: 10000,
        basePayable: 10000,
        challanHeads: [{ name: "Head 1", amount: 1000 }],
        paidAmount: 0,
        status: "PENDING",
      }
    ];

    const result = aggregateStudentPendingReports(rawChallans);
    expect(result).toHaveLength(2);

    const testUser = result.find(s => s.id === "s_test");
    expect(testUser).toBeDefined();
    expect(testUser.pendingChallans[0].totalAmount).toBe(13000);
    expect(testUser.pendingChallans[0].pendingAmount).toBe(13000);
    expect(testUser.totalPending).toBe(13000);

    const testStudent = result.find(s => s.id === "s_test_student");
    expect(testStudent).toBeDefined();
    expect(testStudent.pendingChallans[0].totalAmount).toBe(11000);
    expect(testStudent.pendingChallans[0].pendingAmount).toBe(11000);
    expect(testStudent.totalPending).toBe(11000);
  });

  it("correctly handles advance amounts and partial payments", () => {
    const rawChallans = [
      {
        studentId: "s1",
        studentName: "Advance Student",
        challanNo: "20269999",
        amount: 10000,
        basePayable: 10000,
        advanceApplied: 2000,
        paidAmount: 3000,
        status: "PARTIAL",
      },
    ];

    const result = aggregateStudentPendingReports(rawChallans);
    expect(result).toHaveLength(1);
    const s = result[0];
    // Total is 10000
    // Paid is directPaid (3000) + advanceApplied (2000) = 5000
    // Pending is 10000 - 2000 - 3000 = 5000
    expect(s.pendingChallans[0].totalAmount).toBe(10000);
    expect(s.pendingChallans[0].paidAmount).toBe(5000);
    expect(s.pendingChallans[0].pendingAmount).toBe(5000);
    expect(s.totalPaid).toBe(5000);
    expect(s.totalPending).toBe(5000);
  });
});
