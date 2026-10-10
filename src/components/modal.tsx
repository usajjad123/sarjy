"use client";
import type { ReactNode } from "react";
import { useModalFocus } from "@/hooks/use-modal-focus";
export function Modal({
  labelId,
  onClose,
  children,
}: {
  labelId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useModalFocus(true, onClose);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        {children}
      </section>
    </div>
  );
}
