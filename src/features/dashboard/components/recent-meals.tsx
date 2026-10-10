import type { Meal } from "@/features/food-logging/model";
import { sum } from "@/features/nutrition/engine";
import { formatNumber } from "../format";
import styles from "./dashboard-layout.module.css";

export function RecentMeals({ meals }: { meals: Meal[] }) {
  return (
    <div className={styles.recent}>
      <div>
        <p className="fit-eyebrow">ON YOUR PAGE</p>
        <a href="#food-diary">View food diary ↓</a>
      </div>
      {meals.length ? (
        <ul>
          {meals.slice(-3).map((meal) => (
            <li key={meal.id}>
              <span>{meal.name}</span>
              <small>
                {formatNumber(sum(meal.entries.map((entry) => entry.nutrients)).calories)} kcal
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p>A fresh page. Tell Sarjy what you ate to get started.</p>
      )}
    </div>
  );
}
