import { differenceInYears, differenceInMonths, differenceInDays } from "date-fns";

// Returns true if date is strictly in the future (after today at midnight)
export function isActionDisabled(date) {
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date) > today;
}

export const calculateDuration = (startDate, endDate) => {
    if (!startDate) return "N/A";

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid Date";
    if (start > end) return "Invalid Range";

    const years = differenceInYears(end, start);
    const months = differenceInMonths(end, start) % 12;
    const days = differenceInDays(end, start) % 30; // Rough approximation for days

    let durationParts = [];
    if (years > 0) durationParts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) durationParts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (years === 0 && months === 0 && days >= 0) durationParts.push(`${days} day${days > 1 ? "s" : ""}`);

    return durationParts.join(" ") || "0 days";
};
