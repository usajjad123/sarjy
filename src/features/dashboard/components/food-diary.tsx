import type { Entry, Meal } from "@/features/food-logging/model";
import { context } from "@/features/food-logging/model";
import { sum } from "@/features/nutrition/engine";
import { formatNumber, formatQuantity } from "../format";
import type { FoodAction } from "../types";
export function FoodDiary({
  summary,
  isToday,
  hasPending,
  busy,
  runAction,
  onAddFood,
  onEdit,
  onSave,
}: {
  summary: ReturnType<typeof context>;
  isToday: boolean;
  hasPending: boolean;
  busy: string;
  runAction: FoodAction;
  onAddFood: () => void;
  onEdit: (entry: Entry) => void;
  onSave: (meal: Meal) => void;
}) {
  return (
    <section className="food-diary">
      <div className="section-heading">
        <div>
          <p className="fit-eyebrow">YOUR FOOD DIARY</p>
          <h2>
            {isToday ? "Today’s meals" : "Meals for this day"}
            <span className="count-badge">{summary.meals.length}</span>
          </h2>
        </div>
        <div className="heading-actions">
          <button
            className="text-button"
            disabled={!!busy || !summary.undoableOperation}
            onClick={() => runAction("undo", { operationId: summary.undoableOperation })}
          >
            ↶ Undo
          </button>
          <button className="secondary" disabled={hasPending} onClick={() => onAddFood()}>
            + Add food
          </button>
        </div>
      </div>
      {!summary.meals.length ? (
        <div className="diary-empty">
          <span className="empty-mark">◒</span>
          <h3>A fresh page for your food.</h3>
          <p>
            Tell Sarjy what you ate, or add your first meal here.
            <br />
            Only verified, saved foods count toward your totals.
          </p>
          <button className="text-button" disabled={hasPending} onClick={() => onAddFood()}>
            Log your first meal <span>↗</span>
          </button>
        </div>
      ) : (
        summary.meals.map((meal) => (
          <article className="meal-card" key={meal.id}>
            <div className="meal-heading">
              <div className="meal-symbol" aria-hidden="true">
                {meal.name.toLowerCase().includes("break")
                  ? "☀"
                  : meal.name.toLowerCase().includes("dinner")
                    ? "☾"
                    : "◒"}
              </div>
              <div>
                <h3>{meal.name}</h3>
                <span>
                  {meal.entries.length} foods ·{" "}
                  {formatNumber(sum(meal.entries.map((entry) => entry.nutrients)).calories)} kcal
                </span>
              </div>
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
          </article>
        ))
      )}
    </section>
  );
}
