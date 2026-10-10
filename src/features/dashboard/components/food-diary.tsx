import type { Entry, Meal } from "@/features/food-logging/model";
import { context } from "@/features/food-logging/model";
import type { FoodAction } from "../types";
import { MealCard } from "./meal-card";
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
          <MealCard
            key={meal.id}
            meal={meal}
            busy={busy}
            runAction={runAction}
            onEdit={onEdit}
            onSave={onSave}
          />
        ))
      )}
    </section>
  );
}
