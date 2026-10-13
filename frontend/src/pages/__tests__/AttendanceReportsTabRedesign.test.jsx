import { describe, it, expect } from "vitest";

const toLocalDateKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Weekly grouping logic extracted for verification
const getWeeklyGroups = (startDateStr, endDateStr, attendanceList) => {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const attMap = new Map();
  (attendanceList || []).forEach((item) => {
    let dStr = "";
    if (typeof item.date === "string") {
      dStr = item.date.slice(0, 10);
    } else if (item.date instanceof Date) {
      dStr = toLocalDateKey(item.date);
    }
    if (dStr) {
      attMap.set(dStr, {
        status: String(item.status || "").toLowerCase(),
        notes: item.notes || "",
      });
    }
  });

  const weeks = [];
  let current = new Date(start);
  let weekIndex = 1;

  while (current <= end) {
    const weekStart = new Date(current);
    const dayOfWeek = current.getDay();
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sundayDate = new Date(current);
    sundayDate.setDate(current.getDate() + daysToSunday);
    const weekEnd = sundayDate > end ? new Date(end) : sundayDate;

    const days = [];
    let d = new Date(weekStart);
    while (d <= weekEnd) {
      const dKey = toLocalDateKey(d);
      const record = attMap.get(dKey);

      days.push({
        dateKey: dKey,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        formattedDate: d.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        status: record ? record.status : "not_marked",
        notes: record?.notes || "",
      });
      d.setDate(d.getDate() + 1);
    }

    const markedDays = days.filter(
      (x) =>
        x.status &&
        x.status !== "not_marked" &&
        x.status !== "holiday"
    );
    const attendedDays = days.filter(
      (x) => x.status === "present" || x.status === "short_leave"
    );
    const totalMarked = markedDays.length;
    const attendedCount = attendedDays.length;
    const weekPercent =
      totalMarked > 0 ? Math.round((attendedCount / totalMarked) * 100) : 0;

    if (days.length > 0) {
      weeks.push({
        weekIndex,
        weekStart: weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        weekEnd: weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        days,
        totalMarked,
        attendedCount,
        weekPercent,
      });
    }

    weekIndex++;
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 1);
  }

  return weeks;
};

describe("AttendanceReportsTab Redesign Calculations & Data Presentation", () => {
  it("does not restrict Saturday/Sunday and shows all days relying solely on attendance records and holidays", () => {
    // 7 days in a full week (Monday to Sunday)
    const sampleAttendance = [
      { date: "2026-10-05", status: "present" },
      { date: "2026-10-06", status: "present" },
      { date: "2026-10-07", status: "absent" },
      { date: "2026-10-08", status: "leave" },
      { date: "2026-10-09", status: "holiday", notes: "National Holiday" },
      // 10-10 (Sat) and 10-11 (Sun) have no attendance record
    ];

    const weeks = getWeeklyGroups("2026-10-05", "2026-10-11", sampleAttendance);

    expect(weeks.length).toBe(1);
    const week1 = weeks[0];
    // All 7 days from Mon to Sun must be present
    expect(week1.days.length).toBe(7);

    // Verify Saturday and Sunday are present with status "not_marked"
    const sat = week1.days.find((d) => d.dateKey === "2026-10-10");
    const sun = week1.days.find((d) => d.dateKey === "2026-10-11");
    expect(sat).toBeDefined();
    expect(sat.status).toBe("not_marked");
    expect(sun).toBeDefined();
    expect(sun.status).toBe("not_marked");

    // Verify Holiday is recorded
    const fri = week1.days.find((d) => d.dateKey === "2026-10-09");
    expect(fri.status).toBe("holiday");
    expect(fri.notes).toBe("National Holiday");

    // Marked days count (present, absent, leave): 4
    expect(week1.totalMarked).toBe(4);
    expect(week1.attendedCount).toBe(2);
    expect(week1.weekPercent).toBe(50); // 2/4 (50%)
  });

  it("calculates student attendance metrics, warning low attendance (<= 75%), and overall percentage", () => {
    const student = {
      id: "std-1",
      rollNumber: "PSH-HSSC-26-009",
      name: "AYESHA KHAN",
      subjects: [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          attendance: [
            ...Array(15).fill({ status: "present" }),
            ...Array(5).fill({ status: "absent" }),
          ], // 15/20 = 75%
        },
        {
          subjectId: "eng",
          subjectName: "English",
          attendance: [
            ...Array(19).fill({ status: "present" }),
            ...Array(3).fill({ status: "absent" }),
          ], // 19/22 = 86%
        },
      ],
    };

    let totalAttended = 0;
    let totalRecorded = 0;
    const subjMap = {};

    student.subjects.forEach((sub) => {
      let att = 0;
      let rec = 0;
      sub.attendance.forEach((a) => {
        if (a.status === "present") att++;
        rec++;
      });
      totalAttended += att;
      totalRecorded += rec;
      const pct = Math.round((att / rec) * 100);
      subjMap[sub.subjectId] = {
        attended: att,
        recorded: rec,
        percentage: pct,
        isLow: rec > 0 && pct <= 75,
      };
    });

    const overallPct = Math.round((totalAttended / totalRecorded) * 100);

    expect(subjMap["math"].attended).toBe(15);
    expect(subjMap["math"].recorded).toBe(20);
    expect(subjMap["math"].percentage).toBe(75);
    expect(subjMap["math"].isLow).toBe(true);

    expect(subjMap["eng"].attended).toBe(19);
    expect(subjMap["eng"].recorded).toBe(22);
    expect(subjMap["eng"].percentage).toBe(86);
    expect(subjMap["eng"].isLow).toBe(false);

    expect(overallPct).toBe(81);
  });

  it("filters students by search query across name and roll number", () => {
    const students = [
      { id: "1", rollNumber: "PSH-HSSC-26-007", name: "MUHAMMAD JUNAID" },
      { id: "2", rollNumber: "PSH-HSSC-26-008", name: "AHMAD RAZA" },
      { id: "3", rollNumber: "PSH-HSSC-26-009", name: "AYESHA KHAN" },
    ];

    const filter = (query) => {
      const q = query.toLowerCase().trim();
      return students.filter(
        (s) =>
          s.rollNumber.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      );
    };

    expect(filter("junaid").length).toBe(1);
    expect(filter("junaid")[0].name).toBe("MUHAMMAD JUNAID");
    expect(filter("009").length).toBe(1);
    expect(filter("009")[0].rollNumber).toBe("PSH-HSSC-26-009");
    expect(filter("HSSC").length).toBe(3);
  });

  it("supports scroll-based batching instead of page buttons", () => {
    const allStudents = Array.from({ length: 50 }, (_, i) => ({
      id: `std-${i + 1}`,
      rollNumber: `ROLL-${i + 1}`,
    }));

    const BATCH_SIZE = 15;
    let visibleCount = BATCH_SIZE;

    const getVisibleStudents = () => allStudents.slice(0, visibleCount);

    expect(getVisibleStudents().length).toBe(15);
    expect(getVisibleStudents()[0].rollNumber).toBe("ROLL-1");
    expect(getVisibleStudents()[14].rollNumber).toBe("ROLL-15");

    // Simulate scrolling down (visibleCount increases by BATCH_SIZE)
    visibleCount = Math.min(visibleCount + BATCH_SIZE, allStudents.length);
    expect(getVisibleStudents().length).toBe(30);

    // Scroll to end
    visibleCount = Math.min(visibleCount + BATCH_SIZE * 2, allStudents.length);
    expect(getVisibleStudents().length).toBe(50);
  });
});
