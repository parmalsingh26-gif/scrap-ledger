export const uid = () => Math.random().toString(36).slice(2, 10);
export const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const daysInMonth = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();

export const toMinutes = (t: string) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export const hoursBetween = (inT: string, outT: string) => {
  const a = toMinutes(inT), b = toMinutes(outT);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return +(diff / 60).toFixed(2);
};

export const entryHours = (e: any, timeMode: string) => {
  if (timeMode === "split") {
    return +(hoursBetween(e.inTime, e.outTime) + hoursBetween(e.inTime2, e.outTime2)).toFixed(2);
  }
  return hoursBetween(e.inTime, e.outTime);
};

export const entryNetHours = (e: any, timeMode: string, restMinsPerEntry: number) => {
  const gross = entryHours(e, timeMode);
  const deduct = e.noRest ? 0 : restMinsPerEntry;
  return +(Math.max(0, gross - deduct / 60)).toFixed(2);
};

export function recalcEquipmentMonth(month: any, timeMode: string) {
  const restMins = month.restMins ?? 0;
  const used = +month.entries.reduce((s: number, e: any) => s + entryNetHours(e, timeMode, restMins), 0).toFixed(2);
  const remaining = +(month.previousRemaining - used).toFixed(2);
  return { used, remaining };
}

export function attendanceCount(worker: any, symbol: string) {
  return Object.values(worker.attendance || {}).filter(
    (v: any) => (v || "").toUpperCase() === symbol
  ).length;
}

export function recalcManpowerMonth(month: any) {
  const perDay: Record<number, number> = {};
  for (let d = 1; d <= month.totalDays; d++) {
    if (month.sundays?.includes(d) || month.holidays?.includes(d)) { perDay[d] = 0; continue; }
    perDay[d] = month.workers.reduce(
      (s: number, w: any) => s + ((w.attendance[d] || "").toUpperCase() === "P" ? 1 : 0), 0
    );
  }
  const totalPresent = month.workers.reduce((s: number, w: any) => s + attendanceCount(w, "P"), 0);
  const totalAbsent = month.workers.reduce((s: number, w: any) => s + attendanceCount(w, "A"), 0);
  return { perDay, totalPresent, totalAbsent };
}

export const cellStyle: Record<string, string> = {
  P: "bg-emerald-50 text-emerald-700 border-emerald-200",
  A: "bg-rose-50 text-rose-600 border-rose-200",
  SUNDAY: "bg-gray-100 text-gray-400 border-gray-200",
  HOLIDAY: "bg-amber-50 text-amber-600 border-amber-200",
  "": "bg-white text-gray-300 border-gray-200",
};
export const cellShort: Record<string, string> = { P: "P", A: "A", SUNDAY: "S", HOLIDAY: "H", "": "" };
export const cycleOrder = ["", "P", "A", "SUNDAY", "HOLIDAY"];

export const AI_ATTENDANCE_PROMPT = `You are generating attendance data for a contract management system.
Output ONLY valid JSON — an array of worker objects.

Each object = one worker with this structure:
{
  "name": "WORKER NAME IN CAPS",
  "1": "P", "2": "P", "3": "A", "4": "SUNDAY", ...
}

Day values must be one of: P (Present), A (Absent), SUNDAY, HOLIDAY

Rules:
- All Sundays → "SUNDAY"
- Government holidays → "HOLIDAY"
- Working days where present → "P"
- Working days where absent → "A"
- Days not yet occurred → omit or leave ""
- Worker names must be IN CAPITAL LETTERS

If data has many workers (>15), output in 2 parts:
  Part 1: workers 1–15 as a JSON array
  Part 2: workers 16–end as a JSON array
Each part is valid JSON. The system will import both parts and merge them correctly.

Example output:
[
  { "name": "RAMESH KUMAR", "1": "P", "2": "P", "3": "A", "4": "SUNDAY", "5": "P" },
  { "name": "SURESH LAL", "1": "P", "2": "A", "3": "P", "4": "SUNDAY", "5": "P" }
]`;
