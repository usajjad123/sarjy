import type { Workspace } from "@/features/food-logging/model";
import { sum } from "@/features/nutrition/engine";
import type { FoodAction } from "../types";
import { formatNumber, formatQuantity } from "../format";
export function FoodLibrary({
  workspace,
  today,
  busy,
  runAction,
}: {
  workspace: Workspace;
  today: string;
  busy: string;
  runAction: FoodAction;
}) {
  return (
    <>
      <section className="library-section">
        <div className="section-heading">
          <h2>Your usual meals</h2>
          <span>{workspace.savedMeals.length} remembered</span>
        </div>
        {!workspace.savedMeals.length && (
          <div className="empty-card">Log a meal, then say “Remember this as my usual lunch.”</div>
        )}
        <div className="saved-meal-grid">
          {workspace.savedMeals.map((meal) => (
            <article className="saved-meal-card" key={meal.id}>
              <span className="saved-symbol">◒</span>
              <h3>{meal.name}</h3>
              <p>
                {meal.entries.length} foods ·{" "}
                {formatNumber(sum(meal.entries.map((entry) => entry.nutrients)).calories)} kcal
              </p>
              <ul>
                {meal.entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.food.name}
                    <small>{formatQuantity(entry)}</small>
                  </li>
                ))}
              </ul>
              <button
                className="primary"
                disabled={!!busy}
                onClick={() => runAction("log_saved_meal", { savedMealId: meal.id, date: today })}
              >
                Log for today <span>＋</span>
              </button>
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => runAction("forget_saved_meal", { savedMealId: meal.id })}
              >
                Forget this meal
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="library-section">
        <div className="section-heading">
          <h2>Confirmed foods</h2>
          <span>Reusable USDA matches</span>
        </div>
        {!workspace.foods.length && (
          <div className="empty-card">
            Foods appear here after your first verified meal is logged.
          </div>
        )}
        {workspace.foods.map((food) => (
          <article className="library-food" key={food.id}>
            <div>
              <h3>{food.name}</h3>
              <p>
                {formatNumber(food.per100g.calories)} kcal · {formatNumber(food.per100g.protein)} g
                protein / 100 g
              </p>
              <a href={food.source.url} target="_blank" rel="noreferrer">
                View USDA source ↗
              </a>
            </div>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => runAction("forget_food", { foodId: food.id })}
            >
              Forget
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
