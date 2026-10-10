import type { CSSProperties } from "react";
import { context } from "@/features/food-logging/model";
import { rounded } from "@/features/nutrition/engine";
import { formatNumber } from "../format";
export function NutritionSummary({
  summary,
  onEditGoals,
}: {
  summary: ReturnType<typeof context>;
  onEditGoals: () => void;
}) {
  const calorieProgress = Math.min(100, (summary.totals.calories / summary.goals.calories) * 100);
  return (
    <section className="nutrition-summary">
      <div className="energy-card">
        <div className="energy-title">
          <div>
            <p className="fit-eyebrow">DAILY ENERGY</p>
            <h2>Room for your day.</h2>
          </div>
          <button className="text-button" onClick={() => onEditGoals()}>
            Edit targets ↗
          </button>
        </div>
        <div className="energy-body">
          <div
            className="calorie-ring"
            style={{ "--progress": `${calorieProgress}%` } as CSSProperties}
          >
            <div>
              <strong>{formatNumber(summary.totals.calories)}</strong>
              <span>kcal logged</span>
            </div>
          </div>
          <div className="energy-details">
            <span className="subtle-label">
              {summary.remaining.calories >= 0 ? "Remaining" : "Above your target"}
            </span>
            <strong>
              {formatNumber(Math.abs(summary.remaining.calories))}
              <small>kcal</small>
            </strong>
            <p>of your {formatNumber(summary.goals.calories)} kcal target</p>
            <span className="goal-note">
              {summary.goalsConfigured
                ? "Your chosen targets"
                : "Example targets · Make them yours"}
            </span>
          </div>
        </div>
      </div>
      <div className="macro-card">
        <p className="fit-eyebrow">THE BUILDING BLOCKS</p>
        {(["protein", "carbs", "fat"] as const).map((key) => (
          <div className={`macro ${key}`} key={key}>
            <div>
              <span>{key === "carbs" ? "Carbohydrates" : key[0].toUpperCase() + key.slice(1)}</span>
              <p>
                <strong>{formatNumber(summary.totals[key])}</strong>
                <span> / {formatNumber(summary.goals[key])} g</span>
              </p>
            </div>
            <div
              className="macro-track"
              role="progressbar"
              aria-label={`${key} target progress`}
              aria-valuenow={rounded(summary.totals[key])}
              aria-valuemax={Math.max(summary.goals[key], summary.totals[key])}
            >
              <span
                style={{
                  width: `${Math.min(100, (summary.totals[key] / summary.goals[key]) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
        <small>Calculated from your saved food records.</small>
      </div>
    </section>
  );
}
