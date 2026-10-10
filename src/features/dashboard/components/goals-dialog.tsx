import type { Nutrients } from "@/features/nutrition/engine";
import { FormDialog, type ActionDialogProps } from "./form-dialog";
const nutrientKeys = ["calories", "protein", "carbs", "fat"] as const;
export function GoalsDialog({
  goals,
  busy,
  error,
  runAction,
  onClose,
}: ActionDialogProps & { goals: Nutrients }) {
  return (
    <FormDialog
      title="Your targets. Your choice."
      description="Choose your own daily targets. These are tracking settings."
      busy={!!busy}
      error={error}
      onClose={onClose}
      onSubmit={async (form) => {
        if (
          await runAction(
            "set_goals",
            Object.fromEntries(nutrientKeys.map((key) => [key, Number(form.get(key))])),
          )
        )
          onClose();
      }}
    >
      <div className="form-pair">
        {nutrientKeys.map((key) => (
          <label key={key}>
            {key === "calories" ? "Calories (kcal)" : `${key} (g)`}
            <input
              type="number"
              name={key}
              defaultValue={goals[key]}
              min="1"
              max={key === "calories" ? 10000 : 1000}
              required
            />
          </label>
        ))}
      </div>
    </FormDialog>
  );
}
