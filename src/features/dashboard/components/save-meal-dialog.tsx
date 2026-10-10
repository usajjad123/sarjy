import { Modal } from "@/components/modal";
import type { FoodAction } from "../types";
import type { Meal } from "@/features/food-logging/model";
export function SaveMealDialog({
  meal,
  busy,
  error,
  runAction,
  onClose,
}: {
  meal: Meal;
  busy: string;
  error: string;
  runAction: FoodAction;
  onClose: () => void;
}) {
  return (
    <Modal labelId="save-title" onClose={onClose}>
      <button className="dialog-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <p className="fit-eyebrow">LESS EFFORT NEXT TIME</p>
      <h2 id="save-title">Remember this meal.</h2>
      <p>All foods and quantities become a reusable meal. Your original log stays as it was.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          if (
            await runAction("save_meal", {
              mealId: meal.id,
              name: form.get("name"),
              replace: form.get("replace") === "on",
            })
          )
            onClose();
        }}
      >
        <label>
          Meal name
          <input
            name="name"
            defaultValue={`My usual ${meal.name.toLowerCase()}`}
            required
            maxLength={200}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="replace" />
          Replace an existing saved meal with this name
        </label>
        {error && (
          <p className="fit-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={!!busy}>
          Remember meal <span>♡</span>
        </button>
      </form>
    </Modal>
  );
}
