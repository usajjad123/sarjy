import styles from "./diary-date-navigation.module.css";
import { useDiaryCalendar } from "../use-diary-calendar";
import { CalendarGrid } from "./calendar-grid";
import { dayTitle, formatDiaryDate, shiftDay, shiftMonth } from "../calendar";

function Chevron({ direction }: { direction: "left" | "right" | "down" }) {
  const path =
    direction === "left"
      ? "m14 6-6 6 6 6"
      : direction === "right"
        ? "m10 6 6 6-6 6"
        : "m6 9 6 6 6-6";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function DiaryDateNavigation({
  date,
  today,
  mealDates,
  onChange,
}: {
  date: string;
  today: string;
  mealDates: string[];
  onChange: (date: string) => void;
}) {
  const {
    open,
    setOpen,
    month,
    focusedDate,
    root,
    trigger,
    panelId,
    close,
    select,
    moveFocus,
    navigateGrid,
    toggle,
  } = useDiaryCalendar(date, onChange);
  const recordedDates = new Set(mealDates);

  return (
    <div
      className={styles.dateNavigation}
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className={styles.controls} aria-label="Diary date navigation">
        <button
          className={styles.dayArrow}
          type="button"
          aria-label="Previous day"
          disabled={!date}
          onClick={() => onChange(shiftDay(date, -1))}
        >
          <Chevron direction="left" />
        </button>
        <button
          ref={trigger}
          className={styles.trigger}
          type="button"
          aria-label={
            date
              ? `Choose diary date, ${formatDiaryDate(date, { dateStyle: "full" })}`
              : "Choose diary date"
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          disabled={!date}
          onClick={toggle}
        >
          <span>
            <strong>{date && today ? dayTitle(date, today) : "Your diary"}</strong>
            <small>
              {date
                ? formatDiaryDate(date, { month: "short", day: "numeric", year: "numeric" })
                : "Loading…"}
            </small>
          </span>
          <Chevron direction="down" />
        </button>
        <button
          className={styles.dayArrow}
          type="button"
          aria-label="Next day"
          disabled={!date}
          onClick={() => onChange(shiftDay(date, 1))}
        >
          <Chevron direction="right" />
        </button>
      </div>
      {open && (
        <div className={styles.calendar} role="dialog" aria-label="Choose diary date" id={panelId}>
          <div className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>YOUR FOOD DIARY</span>
              <h2 aria-live="polite">
                {formatDiaryDate(`${month}-01`, { month: "long", year: "numeric" })}
              </h2>
            </div>
            <div className={styles.monthControls}>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => {
                  moveFocus(shiftMonth(focusedDate, -1));
                }}
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  moveFocus(shiftMonth(focusedDate, 1));
                }}
              >
                <Chevron direction="right" />
              </button>
            </div>
          </div>
          <CalendarGrid
            month={month}
            date={date}
            today={today}
            focusedDate={focusedDate}
            recordedDates={recordedDates}
            onSelect={select}
            onKeyDown={navigateGrid}
          />
          <div className={styles.footer}>
            <span>
              <i /> Meals logged
            </span>
            <button type="button" onClick={() => select(today)}>
              Back to today <span aria-hidden="true">↗</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close calendar"
            onClick={close}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
