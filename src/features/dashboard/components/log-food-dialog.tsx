import { FormDialog, type ActionDialogProps } from "./form-dialog";
export function LogFoodDialog({
  date,
  busy,
  error,
  runAction,
  onClose,
}: ActionDialogProps & { date: string }) {
  return (
    <FormDialog
      title="What did you eat?"
      description="Find a verified food, check the portion, then log it."
      busy={!!busy}
      error={error}
      onClose={onClose}
      submitLabel="Create food draft"
      onSubmit={async (form) => {
        if (
          await runAction("start_food_log", {
            mealName: form.get("mealName"),
            date,
            items: [
              {
                query: form.get("query"),
                quantity: { amount: Number(form.get("amount")), unit: form.get("unit") },
              },
            ],
          })
        )
          onClose();
      }}
    >
      <label>
        Meal name
        <input name="mealName" defaultValue="Lunch" required maxLength={200} />
      </label>
      <label>
        Food and preparation
        <input
          name="query"
          placeholder="Chicken breast, cooked, roasted"
          required
          maxLength={200}
        />
      </label>
      <div className="form-pair">
        <label>
          Amount
          <input
            name="amount"
            type="number"
            step="0.1"
            min="0.1"
            max="10000"
            defaultValue="200"
            required
          />
        </label>
        <label>
          Unit
          <select name="unit">
            <option value="g">Grams</option>
            <option value="ml">Milliliters</option>
            <option value="piece">Pieces</option>
            <option value="serving">USDA servings</option>
          </select>
        </label>
      </div>
    </FormDialog>
  );
}
