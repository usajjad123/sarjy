import type { KeyboardEvent } from "react";
import { calendarDays, formatDiaryDate } from "../calendar";
import styles from "./diary-date-navigation.module.css";

type CalendarGridProps = {
  month: string;
  date: string;
  today: string;
  focusedDate: string;
  recordedDates: Set<string>;
  onSelect: (date: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: string) => void;
};
export function CalendarGrid({
  month,
  date,
  today,
  focusedDate,
  recordedDates,
  onSelect,
  onKeyDown,
}: CalendarGridProps) {
  const days = calendarDays(month);
  return (
    <div
      role="grid"
      aria-label={formatDiaryDate(`${month}-01`, { month: "long", year: "numeric" })}
    >
      <div className={styles.week} role="row">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} role="columnheader" aria-label={day} className={styles.weekday}>
            {day.slice(0, 1)}
          </span>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, week) => (
        <div className={styles.week} role="row" key={week}>
          {days.slice(week * 7, week * 7 + 7).map((value) => (
            <div key={value} role="gridcell" aria-selected={value === date}>
              <button
                type="button"
                data-date={value}
                data-outside={value.slice(0, 7) !== month}
                data-selected={value === date}
                data-today={value === today}
                aria-current={value === today ? "date" : undefined}
                aria-label={`${formatDiaryDate(value, { dateStyle: "full" })}${recordedDates.has(value) ? ", meals logged" : ""}`}
                tabIndex={value === focusedDate ? 0 : -1}
                onKeyDown={(event) => onKeyDown(event, value)}
                onClick={() => onSelect(value)}
              >
                <span>{Number(value.slice(-2))}</span>
                <i className={recordedDates.has(value) ? styles.hasMeals : ""} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
