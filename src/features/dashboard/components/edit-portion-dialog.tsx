import { PlannerDialog } from "@/components/planner-dialog";
import type { FoodAction } from "../types";
import type { Entry } from "@/features/food-logging/model";
import { QuantityForm } from "./quantity-form";
export function EditPortionDialog({
  entry,
  busy,
  error,
  runAction,
  onClose,
}: {
  entry: Entry;
  busy: string;
  error: string;
  runAction: FoodAction;
  onClose: () => void;
}) {
  return (
    <PlannerDialog labelId="edit-title" onClose={() => onClose()}>
      <button className="dialog-close" aria-label="Close" onClick={() => onClose()}>
        ×
      </button>
      <p className="fit-eyebrow">CORRECT THE RECORD</p>
      <h2 id="edit-title">Update your portion.</h2>
      <p>{entry.food.name}</p>
      <QuantityForm
        food={entry.food}
        initial={entry.quantity}
        busy={!!busy}
        submitLabel="Save correction"
        onSubmit={async (quantity) => {
          if (await runAction("update_quantity", { entryId: entry.id, quantity })) onClose();
        }}
      />
      {error && (
        <p className="fit-error" role="alert">
          {error}
        </p>
      )}
    </PlannerDialog>
  );
}
