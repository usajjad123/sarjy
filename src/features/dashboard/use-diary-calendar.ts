import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { parseDiaryDate, shiftDay, shiftMonth } from "./calendar";

export function useDiaryCalendar(date: string, onChange: (date: string) => void) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [focusedDate, setFocusedDate] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)?.focus();
  }, [open, focusedDate, month]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const select = (value: string) => {
    onChange(value);
    close();
  };
  const moveFocus = (value: string) => {
    setFocusedDate(value);
    setMonth(value.slice(0, 7));
  };
  const navigateGrid = (event: KeyboardEvent<HTMLButtonElement>, value: string) => {
    let next: string;
    const weekday = (parseDiaryDate(value).getUTCDay() + 6) % 7;
    switch (event.key) {
      case "ArrowLeft":
        next = shiftDay(value, -1);
        break;
      case "ArrowRight":
        next = shiftDay(value, 1);
        break;
      case "ArrowUp":
        next = shiftDay(value, -7);
        break;
      case "ArrowDown":
        next = shiftDay(value, 7);
        break;
      case "Home":
        next = shiftDay(value, -weekday);
        break;
      case "End":
        next = shiftDay(value, 6 - weekday);
        break;
      case "PageUp":
        next = shiftMonth(value, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = shiftMonth(value, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setMonth(date.slice(0, 7));
    setFocusedDate(date);
    setOpen(true);
  };
  return {
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
  };
}
