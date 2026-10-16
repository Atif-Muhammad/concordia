import { openManagedPrintWindow } from "@/lib/managedPrint";

/**
 * Converts a numeric amount to formal words format (e.g. 15000 -> Fifteen Thousand Rupees Only)
 */
export const numberToWords = (num) => {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return "Zero Rupees Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertChunk = (val) => {
    let str = "";
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + " ";
      val %= 10;
    }
    if (val > 0) {
      str += ones[val] + " ";
    }
    return str.trim();
  };

  let result = "";
  let rem = n;

  if (rem >= 1000000000) {
    result += convertChunk(Math.floor(rem / 1000000000)) + " Billion ";
    rem %= 1000000000;
  }
  if (rem >= 1000000) {
    result += convertChunk(Math.floor(rem / 1000000)) + " Million ";
    rem %= 1000000;
  }
  if (rem >= 1000) {
    result += convertChunk(Math.floor(rem / 1000)) + " Thousand ";
    rem %= 1000;
  }
  if (rem > 0) {
    result += convertChunk(rem) + " ";
  }

  return (result.trim() + " Rupees Only").replace(/\s+/g, " ");
};

/**
 * Helper to fetch and convert college logo to base64 Data URL for standalone popup printing
 */
export const getCollegeLogoDataUrl = async () => {
  if (typeof window === "undefined") return "/logo.png";
  try {
    const res = await fetch("/logo.png");
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(`${window.location.origin}/logo.png`);
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // fallback
  }
  return `${window.location.origin}/logo.png`;
};

/**
 * Generates high-fidelity HTML for Concordia College Peshawar Expense Receipt
 * Fully styled with inline CSS so printing never loses styles or logo dimensions.
 */
export const generateExpenseReceiptHtml = ({
  expense,
  issuerName = "",
  logoUrl = "/logo.png",
  printDate = new Date(),
}) => {
  if (!expense) return "";

  const voucherNo =
    expense.receiptNo ||
    expense.voucherNo ||
    (String(expense.id || expense._id || "").slice(-8).toUpperCase()) ||
    "001";

  const rawDate = expense.date ? new Date(expense.date) : new Date();
  const expenseDate = !isNaN(rawDate.getTime())
    ? rawDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : String(expense.date || "");

  const rawCreatedAt = expense.createdAt ? new Date(expense.createdAt) : new Date();
  const issueDateTime = !isNaN(rawCreatedAt.getTime())
    ? rawCreatedAt.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : new Date().toLocaleString("en-GB");

  const issuer =
    issuerName ||
    expense.createdByName ||
    expense.createdBy?.name ||
    expense.approvedByName ||
    expense.issuer ||
    "Accounts Staff";

  const category =
    expense.category ||
    (expense.expenseType ? "Inventory" : "General Expense");

  const subCategory =
    expense.subCategory ||
    expense.expenseType ||
    expense.inventoryItem?.itemName ||
    expense.itemName ||
    "—";

  // Build descriptive text including item name if present in inventory
  let description = expense.description || expense.expenseTitle || expense.title || "Official Expense";
  if (expense.inventoryItem?.itemName && !description.includes(expense.inventoryItem.itemName)) {
    description = `[Item: ${expense.inventoryItem.itemName}] ${description}`;
  } else if (expense.itemName && !description.includes(expense.itemName)) {
    description = `[Item: ${expense.itemName}] ${description}`;
  }

  const rawAmount = Number(expense.amount || 0);
  const formattedAmount = rawAmount.toLocaleString("en-PK");
  const amountWords = numberToWords(rawAmount);

  const paymentAccount = expense.walletName || expense.paymentMethod || "College Treasury Account";
  const vendor = expense.vendor || "";

  const printTimestamp = printDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Expense Receipt - VCH-${voucherNo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
  </style>
</head>
<body style="margin: 0; padding: 16px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #0f172a; background: #ffffff;">
  <div style="max-width: 780px; margin: 0 auto; border: 2px solid #0f172a; border-top: 6px solid #1e3a8a; padding: 24px; background: #ffffff; box-sizing: border-box;">
    
    <!-- HEADER -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 12px; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${logoUrl}" alt="Concordia College Peshawar" style="width: 70px; height: 70px; max-width: 70px; max-height: 70px; object-fit: contain; flex-shrink: 0;" />
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; font-family: 'Playfair Display', Georgia, serif; line-height: 1.2;">Concordia College Peshawar</h1>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">60-C University Road, University Town, Peshawar &bull; Tel: 091-5619915</div>
        </div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div style="font-family: monospace; font-size: 13px; font-weight: 700; color: #1e3a8a; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 4px;">
          VCH-${voucherNo}
        </div>
      </div>
    </div>

    <!-- CALLIGRAPHIC TITLE -->
    <div style="text-align: center; margin: 10px 0 14px 0;">
      <div style="font-family: 'Alex Brush', 'Great Vibes', 'Dancing Script', 'Brush Script MT', cursive; font-size: 38px; color: #1e3a8a; line-height: 1.1; font-weight: 500;">
        Expense Receipt
      </div>
      <div style="width: 140px; height: 2px; background: #b45309; margin: 6px auto 0 auto;"></div>
    </div>

    <!-- METADATA BOX -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px;">
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: 120px; flex-shrink: 0;">Expense Date:</span>
        <span style="font-weight: 700; color: #1e3a8a;">${expenseDate}</span>
      </div>
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: 130px; flex-shrink: 0;">Issue Date &amp; Time:</span>
        <span style="color: #0f172a;">${issueDateTime}</span>
      </div>
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: 120px; flex-shrink: 0;">Issued By (Staff):</span>
        <span style="font-weight: 600; color: #0f172a;">${issuer}</span>
      </div>
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: 130px; flex-shrink: 0;">Paid From Account:</span>
        <span style="color: #0f172a;">${paymentAccount}</span>
      </div>
      ${
        vendor
          ? `
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: 120px; flex-shrink: 0;">Vendor / Payee:</span>
        <span style="color: #0f172a;">${vendor}</span>
      </div>
      `
          : ""
      }
      <div style="display: flex; align-items: baseline;">
        <span style="font-weight: 700; color: #475569; width: ${vendor ? "130px" : "120px"}; flex-shrink: 0;">Voucher Ref:</span>
        <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${voucherNo}</span>
      </div>
    </div>

    <!-- TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; border: 1px solid #0f172a;">
      <thead>
        <tr style="background: #1e293b; color: #ffffff;">
          <th style="padding: 10px 8px; border: 1px solid #0f172a; text-align: center; width: 40px; font-size: 11px; text-transform: uppercase;">#</th>
          <th style="padding: 10px 10px; border: 1px solid #0f172a; text-align: left; width: 130px; font-size: 11px; text-transform: uppercase;">Category</th>
          <th style="padding: 10px 10px; border: 1px solid #0f172a; text-align: left; width: 140px; font-size: 11px; text-transform: uppercase;">Sub Category</th>
          <th style="padding: 10px 10px; border: 1px solid #0f172a; text-align: left; font-size: 11px; text-transform: uppercase;">Description</th>
          <th style="padding: 10px 10px; border: 1px solid #0f172a; text-align: right; width: 130px; font-size: 11px; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #ffffff;">
          <td style="padding: 12px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">1</td>
          <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${category}</td>
          <td style="padding: 12px 10px; border: 1px solid #cbd5e1; color: #334155;">${subCategory}</td>
          <td style="padding: 12px 10px; border: 1px solid #cbd5e1; color: #0f172a; line-height: 1.4;">${description}</td>
          <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: 700; font-size: 13px; color: #0f172a;">PKR ${formattedAmount}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background: #f1f5f9; font-weight: 700;">
          <td colspan="4" style="padding: 10px 12px; border: 1px solid #0f172a; text-align: right; text-transform: uppercase; font-size: 11px; color: #475569;">Total Expense Amount:</td>
          <td style="padding: 10px 10px; border: 1px solid #0f172a; text-align: right; font-family: monospace; font-size: 14px; font-weight: 800; color: #0f172a;">PKR ${formattedAmount}</td>
        </tr>
      </tfoot>
    </table>

    <!-- AMOUNT IN WORDS -->
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 10px 14px; margin-bottom: 30px; font-size: 12px; color: #92400e;">
      <strong style="color: #78350f;">Amount in Words:</strong> <span style="font-style: italic;">${amountWords}</span>
    </div>

    <!-- SIGNATURES -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 50px; text-align: center;">
      <div>
        <div style="border-top: 1.5px solid #475569; width: 85%; margin: 0 auto 6px auto;"></div>
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Issued / Prepared By</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${issuer}</div>
      </div>
      <div>
        <div style="border-top: 1.5px solid #475569; width: 85%; margin: 0 auto 6px auto;"></div>
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Accounts Officer</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Verified &amp; Entered</div>
      </div>
      <div>
        <div style="border-top: 1.5px solid #475569; width: 85%; margin: 0 auto 6px auto;"></div>
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Principal / Director</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Authorized Signature</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="border-top: 1px dashed #cbd5e1; margin-top: 30px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
      <div>Official Computer-Generated Expense Receipt &bull; Concordia College Peshawar</div>
      <div>Printed: ${printTimestamp}</div>
    </div>

  </div>
</body>
</html>`;
};

/**
 * Universal print handler for Expense receipts
 */
export const printExpenseReceipt = async ({
  expense,
  currentUser = null,
  toast = null,
  printWindow = null,
}) => {
  if (!expense) return false;

  try {
    const logoUrl = await getCollegeLogoDataUrl();
    const issuerName =
      expense.createdByName ||
      expense.createdBy?.name ||
      expense.approvedByName ||
      expense.issuer ||
      currentUser?.name ||
      "Staff";

    const html = generateExpenseReceiptHtml({
      expense,
      issuerName,
      logoUrl,
      printDate: new Date(),
    });

    const voucherNo =
      expense.receiptNo ||
      expense.voucherNo ||
      (String(expense.id || expense._id || "").slice(-8).toUpperCase()) ||
      "Receipt";

    return await openManagedPrintWindow({
      html,
      title: `Expense_Receipt_${voucherNo}`,
      toast,
      printWindow,
    });
  } catch (error) {
    console.error("Failed to print expense receipt:", error);
    toast?.({
      title: "Print Failed",
      description: "Unable to generate expense receipt print view.",
      variant: "destructive",
    });
    return false;
  }
};
