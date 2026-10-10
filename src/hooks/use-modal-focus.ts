import { useEffect, useRef } from "react";

// Shared by form dialogs and the expanded conversation; restore focus on close.
export function useModalFocus(open: boolean, onClose: () => void, fallbackSelector?: string) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !panel.current) return;
    const element = panel.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length > 0);
    focusable()[0]?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      } else if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target))
        focusable()[0]?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocus);
      document.body.style.overflow = previousOverflow;
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus !== document.body &&
        previousFocus !== document.documentElement &&
        previousFocus.isConnected &&
        previousFocus.getClientRects().length
      )
        previousFocus.focus({ preventScroll: true });
      else if (fallbackSelector)
        document.querySelector<HTMLElement>(fallbackSelector)?.focus({ preventScroll: true });
    };
  }, [open, fallbackSelector]);
  return panel;
}
