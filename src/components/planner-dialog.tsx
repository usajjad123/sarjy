"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function PlannerDialog({
  labelId,
  onClose,
  children,
  className = "",
}: {
  labelId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.current?.contains(document.activeElement))
      dialog.current?.querySelector<HTMLElement>("input, button, select")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected && !element?.contains(previous)) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className={`planner-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const focusable = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
              ),
            ].filter((item) => item.getClientRects().length);
            const first = focusable[0],
              last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        {children}
      </section>
    </div>
  );
}
