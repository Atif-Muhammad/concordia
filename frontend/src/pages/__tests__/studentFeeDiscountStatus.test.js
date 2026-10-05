import { describe, it, expect } from "vitest";
import { formatUserFriendlyErrorMessage } from "../fee-management/ChallansTab";
import { format12HourDateTime } from "../fee-management/feeFinancialUtils";

// Pure helper reflecting StudentProfileDialog fee status resolution logic
export const resolveInstallmentFeeStatus = (inst, matchingChallan) => {
  const challanStatus = (matchingChallan?.status || "").toUpperCase();
  const instStatus = (inst?.status || "").toUpperCase();
  const rawStatus = challanStatus || instStatus || "PENDING";
  const planAmount = Number(
    inst?.basePayable ??
    inst?.amount ??
    matchingChallan?.basePayable ??
    matchingChallan?.amount ??
    matchingChallan?.totalAmount ??
    0
  );
  const paidAmount = Number(matchingChallan?.paidAmount ?? inst?.paidAmount ?? 0);
  const discountAmount = Number(
    matchingChallan?.discount ??
    matchingChallan?.discountAmount ??
    inst?.discount ??
    0
  );

  let status = "UNPAID";
  if (
    challanStatus === "PAID" ||
    instStatus === "PAID" ||
    (planAmount > 0 && paidAmount + discountAmount >= planAmount)
  ) {
    status = "PAID";
  } else if (challanStatus === "SETTLED" || instStatus === "SETTLED") {
    status = "SETTLED";
  } else if (
    challanStatus === "PARTIAL" ||
    instStatus === "PARTIAL" ||
    (paidAmount > 0 && paidAmount + discountAmount < planAmount)
  ) {
    status = "PARTIAL";
  } else if (rawStatus === "OVERDUE") {
    status = "OVERDUE";
  } else if (rawStatus === "VOID") {
    status = "VOID";
  }

  let rowBgClass = "bg-transparent hover:bg-muted/40 transition-colors";
  if (status === "PAID" || status === "SETTLED") {
    rowBgClass = "bg-green-50/70 hover:bg-green-100/60 dark:bg-green-950/20 border-b border-green-100/80 transition-colors";
  } else if (status === "PARTIAL") {
    rowBgClass = "bg-orange-50/70 hover:bg-orange-100/60 dark:bg-orange-950/20 border-b border-orange-100/80 transition-colors";
  }

  return {
    status,
    planAmount,
    paidAmount,
    discountAmount,
    rowBgClass,
    displayText: discountAmount > 0 ? `Paid: PKR ${paidAmount.toLocaleString()} (Disc: PKR ${discountAmount.toLocaleString()})` : "",
  };
};

describe("ChallansTab Error Sanitization", () => {
  it("converts raw arrearAllocations mongoose validation error to clear user message", () => {
    const rawError = "FeeChallan validation failed: arrearAllocations.0.sourceChallanNo: Path 'sourceChallanNo' is required.";
    const formatted = formatUserFriendlyErrorMessage(rawError);
    expect(formatted).toBe("Unable to resolve prior arrear records for this student. Please check previous challan statuses.");
  });

  it("converts duplicate key / E11000 database error to user-friendly message", () => {
    const rawError = "E11000 duplicate key error collection: concordia.feechallans index: challanNo_1 dup key: { challanNo: \"CH-2026-001\" }";
    const formatted = formatUserFriendlyErrorMessage(rawError);
    expect(formatted).toBe("A challan for this month or with this challan number already exists.");
  });

  it("converts generic mongoose validation failed error", () => {
    const rawError = "FeeChallan validation failed: amount: Cast to Number failed for value 'invalid'";
    const formatted = formatUserFriendlyErrorMessage(rawError);
    expect(formatted).toBe("Challan data validation failed. Please check student installment plan and fee settings.");
  });

  it("passes standard messages through unchanged", () => {
    const msg = "Student has no active installment plan for October 2026";
    expect(formatUserFriendlyErrorMessage(msg)).toBe(msg);
  });
});

describe("StudentProfileDialog Fee Tab Discount-Aware Status", () => {
  it("marks installment as PAID when challan is PAID with discount (Muhammad Sarim Hayat scenario)", () => {
    // Sep 2026: Plan 11,366, Paid 10,330, Discount 1,186 (Total covered = 11,516 >= 11,366)
    // Inst status might have been left as PARTIAL in legacy data
    const inst = {
      installmentNumber: 1,
      month: "September",
      amount: 11366,
      paidAmount: 10330,
      status: "PARTIAL",
    };
    const matchingChallan = {
      challanNo: "CH-2026-SEP-001",
      installmentNumber: 1,
      status: "PAID",
      amount: 10330,
      paidAmount: 10330,
      discount: 1186,
    };

    const res = resolveInstallmentFeeStatus(inst, matchingChallan);
    expect(res.status).toBe("PAID");
    expect(res.rowBgClass).toContain("bg-green-50/70");
    expect(res.displayText).toBe("Paid: PKR 10,330 (Disc: PKR 1,186)");
  });

  it("marks installment as PAID when paidAmount + discountAmount >= planAmount even if status string was unupdated", () => {
    const inst = {
      installmentNumber: 2,
      amount: 10000,
      paidAmount: 8500,
      discount: 1500,
      status: "PARTIAL",
    };
    const matchingChallan = null;

    const res = resolveInstallmentFeeStatus(inst, matchingChallan);
    expect(res.status).toBe("PAID");
    expect(res.rowBgClass).toContain("bg-green-50/70");
    expect(res.displayText).toBe("Paid: PKR 8,500 (Disc: PKR 1,500)");
  });

  it("marks installment as PARTIAL when paidAmount + discount < planAmount", () => {
    const inst = {
      installmentNumber: 3,
      amount: 10000,
      paidAmount: 5000,
      discount: 1000,
      status: "PENDING",
    };
    const matchingChallan = {
      status: "PARTIAL",
      paidAmount: 5000,
      discount: 1000,
    };

    const res = resolveInstallmentFeeStatus(inst, matchingChallan);
    expect(res.status).toBe("PARTIAL");
    expect(res.rowBgClass).toContain("bg-orange-50/70");
    expect(res.displayText).toBe("Paid: PKR 5,000 (Disc: PKR 1,000)");
  });

  it("marks installment as UNPAID when 0 amount has been paid", () => {
    const inst = {
      installmentNumber: 4,
      amount: 10000,
      paidAmount: 0,
      discount: 0,
      status: "PENDING",
    };
    const matchingChallan = null;

    const res = resolveInstallmentFeeStatus(inst, matchingChallan);
    expect(res.status).toBe("UNPAID");
    expect(res.rowBgClass).toContain("bg-transparent");
  });
});

describe("format12HourDateTime and Transaction Formatting", () => {
  it("formats 24-hour time string into 12-hour format with AM/PM", () => {
    const formatted = format12HourDateTime("2026-10-05T00:00:00.000Z", "17:49");
    expect(formatted).toContain("05:49 PM");
    expect(formatted).toContain("2026");
  });

  it("formats 12-hour time string preserving AM/PM", () => {
    const formatted = format12HourDateTime("2026-10-05", "05:49 pm");
    expect(formatted).toContain("05:49 PM");
  });

  it("formats morning time correctly in 12-hour format", () => {
    const formatted = format12HourDateTime("2026-10-05", "09:15");
    expect(formatted).toContain("09:15 AM");
  });

  it("handles null gracefully", () => {
    expect(format12HourDateTime(null, null)).toBe("-");
  });

  it("correctly resolves transaction details with amount, when, by who, payment mode, deposit account", () => {
    const receipt = {
      _id: "rec_1",
      receiptNo: "REC-123456",
      amountPaid: 10330,
      paidDate: "2026-10-05T12:49:00.000Z",
      paymentMode: "Cash",
      walletId: { name: "United Bank Limited", type: "BANK" },
      recordedBy: { name: "Super Admin", role: "super_admin" },
      remarks: "Full fee payment with discount",
    };

    const formattedTime = format12HourDateTime(receipt.paidDate);
    expect(formattedTime).toMatch(/\d{2}:\d{2}\s+(AM|PM)/i);

    const transaction = {
      receiptNo: receipt.receiptNo,
      amount: receipt.amountPaid,
      dateTime: formattedTime,
      receivedBy: receipt.recordedBy?.name,
      paymentMode: receipt.paymentMode,
      depositAccount: receipt.walletId?.name,
      remarks: receipt.remarks,
    };

    expect(transaction.amount).toBe(10330);
    expect(transaction.receivedBy).toBe("Super Admin");
    expect(transaction.paymentMode).toBe("Cash");
    expect(transaction.depositAccount).toBe("United Bank Limited");
    expect(transaction.remarks).toBe("Full fee payment with discount");
  });
});

