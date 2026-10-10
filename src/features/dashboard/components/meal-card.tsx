import type { Entry, Meal } from "@/features/food-logging/model";
import { sum } from "@/features/nutrition/engine";
import { formatNumber, formatQuantity } from "../format";
import type { FoodAction } from "../types";
import styles from "./meal-card.module.css";

export function MealCard({
  meal,
  busy,
  runAction,
  onEdit,
  onSave,
}: {
  meal: Meal;
  busy: string;
  runAction: FoodAction;
  onEdit: (entry: Entry) => void;
  onSave: (meal: Meal) => void;
}) {
  const totals = sum(meal.entries.map((entry) => entry.nutrients));
  const name = meal.name.toLowerCase();
  const nutrients = [
    { label: "Calories", value: totals.calories, unit: "kcal" },
    { label: "Protein", value: totals.protein, unit: "g" },
    { label: "Carbs", value: totals.carbs, unit: "g" },
    { label: "Fat", value: totals.fat, unit: "g" },
  ];

  return (
    <details className={styles.card}>
      <summary className={styles.summary}>
        <span className={styles.symbol} aria-hidden="true">
          {name.includes("break") ? "☀" : name.includes("dinner") ? "☾" : "◒"}
        </span>
        <div className={styles.identity}>
          <h3>{meal.name}</h3>
          <p>
            {meal.entries.length} {meal.entries.length === 1 ? "food" : "foods"}
          </p>
        </div>
        <dl className={styles.nutrients}>
          {nutrients.map(({ label, value, unit }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {formatNumber(value)} <small>{unit}</small>
              </dd>
            </div>
          ))}
        </dl>
        <svg
          className={styles.chevron}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className={styles.content}>
        <div className={styles.actions}>
          <button
            className="text-button"
            disabled={!meal.entries.length}
            onClick={() => onSave(meal)}
          >
            Remember meal ♡
          </button>
        </div>
        <div className="food-table">
          <div className="food-table-head">
            <span>Food & portion</span>
            <span>Calories</span>
            <span>Protein</span>
            <span />
          </div>
          {meal.entries.map((entry) => (
            <div className="food-row" key={entry.id}>
              <div>
                <strong>{entry.food.name}</strong>
                <p>{formatQuantity(entry)}</p>
                <a href={entry.food.source.url} target="_blank" rel="noreferrer">
                  USDA · {entry.food.source.fdcId} ↗
                </a>
              </div>
              <span>
                {formatNumber(entry.nutrients.calories)}
                <small> kcal</small>
              </span>
              <span>
                {formatNumber(entry.nutrients.protein)}
                <small> g</small>
              </span>
              <div className="row-actions">
                <button
                  aria-label={`Edit ${entry.food.name}`}
                  title="Edit quantity"
                  disabled={!!busy}
                  onClick={() => onEdit(entry)}
                >
                  ✎
                </button>
                <button
                  aria-label={`Remove ${entry.food.name}`}
                  title="Remove food"
                  disabled={!!busy}
                  onClick={() => runAction("remove_entry", { entryId: entry.id })}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
