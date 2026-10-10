// Diary dates are civil dates. UTC arithmetic avoids browser timezone and DST shifts.
export function parseDiaryDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}
export function shiftDay(date: string, days: number) {
  const value = parseDiaryDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function shiftMonth(date: string, months: number) {
  const value = parseDiaryDate(date);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
  ).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}
export function calendarDays(month: string) {
  const first = `${month}-01`;
  const mondayOffset = (parseDiaryDate(first).getUTCDay() + 6) % 7;
  const start = shiftDay(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => shiftDay(start, index));
}
export function formatDiaryDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    parseDiaryDate(date),
  );
}
export function dayTitle(date: string, today: string) {
  if (date === today) return "Today";
  if (date === shiftDay(today, -1)) return "Yesterday";
  if (date === shiftDay(today, 1)) return "Tomorrow";
  return formatDiaryDate(date, { weekday: "long" });
}
