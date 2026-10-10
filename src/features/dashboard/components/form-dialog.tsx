import type { ReactNode } from "react";
import { PlannerDialog } from "@/components/planner-dialog";
import { Icon } from "./icon";
export type FormDialogProps = {
  title: string;
  description: string;
  children: ReactNode;
  busy: boolean;
  error: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (form: FormData) => Promise<void>;
};
export function FormDialog({
  title,
  description,
  children,
  busy,
  error,
  submitLabel = "Save",
  onClose,
  onSubmit,
}: FormDialogProps) {
  return (
    <PlannerDialog labelId="form-title" onClose={onClose}>
      <button className="dialog-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <p className="fit-eyebrow">SARJY FIT</p>
      <h2 id="form-title">{title}</h2>
      <p>{description}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit(new FormData(event.currentTarget));
        }}
      >
        {children}
        {error && (
          <p className="fit-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
          <Icon name="arrow" />
        </button>
      </form>
    </PlannerDialog>
  );
}
export type ActionDialogProps = {
  busy: string;
  error: string;
  runAction: import("../types").FoodAction;
  onClose: () => void;
};
