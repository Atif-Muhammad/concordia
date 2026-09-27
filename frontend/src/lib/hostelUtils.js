export function computeOutstandingBalance(registration, payments) {
  const { decidedFeePerMonth, registrationDate } = registration;
  if (!decidedFeePerMonth || decidedFeePerMonth <= 0) return null; // "No Fee Set"

  const start = new Date(registrationDate);
  const now = new Date();
  const monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) + 1;

  const totalDue = decidedFeePerMonth * Math.max(0, monthsElapsed);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return totalDue - totalPaid;
}
