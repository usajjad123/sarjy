import { useState } from "react";
import type { Entry } from "@/features/food-logging/model";
import type { Quantity } from "@/features/nutrition/engine";
export function QuantityForm({
  food,
  initial,
  busy,
  submitLabel,
  onSubmit,
}: {
  food: Entry["food"];
  initial?: Quantity;
  busy: boolean;
  submitLabel: string;
  onSubmit: (q: Quantity) => unknown;
}) {
  const [unit, setUnit] = useState(initial?.unit || "g");
  const portions = food.portions.filter((portion) => portion.unit === unit);
  return (
    <form
      className="quantity-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          amount: Number(form.get("amount")),
          unit,
          ...(unit !== "g" && form.get("portionId")
            ? { portionId: String(form.get("portionId")) }
            : {}),
        });
      }}
    >
      <div className="form-pair">
        <label>
          Amount
          <input
            key={initial?.amount}
            name="amount"
            type="number"
            min="0.01"
            max="10000"
            step="0.01"
            defaultValue={initial?.amount || 1}
            required
          />
        </label>
        <label>
          Unit
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value as Quantity["unit"])}
          >
            <option value="g">Grams</option>
            <option value="ml">Milliliters</option>
            <option value="piece">Pieces</option>
            <option value="serving">USDA servings</option>
          </select>
        </label>
      </div>
      {unit !== "g" && (
        <label>
          Verified portion
          <select
            key={`${unit}:${initial?.portionId}`}
            name="portionId"
            defaultValue={initial?.portionId || ""}
            required
          >
            <option value="" disabled>
              Choose a USDA portion
            </option>
            {portions.map((portion) => (
              <option key={portion.id} value={portion.id}>
                {portion.label}
              </option>
            ))}
          </select>
          {!portions.length && (
            <small>No verified conversion for this unit. Use weighed grams.</small>
          )}
        </label>
      )}
      <button className="secondary" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}
