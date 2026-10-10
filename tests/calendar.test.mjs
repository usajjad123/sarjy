import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/features/dashboard/calendar.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { shiftDay, shiftMonth, calendarDays, dayTitle, formatDiaryDate } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("diary navigation crosses months, years and leap days without skipping a date", () => {
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDay("2024-02-29", 1), "2024-03-01");
});
test("month navigation clamps long-month dates instead of skipping February", () => {
  assert.equal(shiftMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftMonth("2024-03-31", -1), "2024-02-29");
  assert.equal(shiftMonth("2024-02-29", 12), "2025-02-28");
  assert.equal(shiftMonth("2026-12-10", 1), "2027-01-10");
});
test("calendar includes all month dates once, in Monday-first complete weeks", () => {
  const days = calendarDays("2026-02");
  assert.equal(days.length, 42);
  assert.equal(days[0], "2026-01-26");
  assert.equal(days.at(-1), "2026-03-08");
  assert.equal(new Set(days).size, 42);
  assert.equal(days.filter((day) => day.startsWith("2026-02")).length, 28);
});
test("browser timezone and daylight-saving transitions cannot shift diary labels", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["America/Los_Angeles", "Pacific/Kiritimati", "Asia/Riyadh"]) {
      process.env.TZ = timezone;
      assert.equal(shiftDay("2026-03-08", 1), "2026-03-09");
      assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
      assert.equal(
        formatDiaryDate("2026-10-10", { dateStyle: "full" }),
        "Saturday, October 10, 2026",
      );
      assert.equal(dayTitle("2026-10-09", "2026-10-10"), "Yesterday");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
