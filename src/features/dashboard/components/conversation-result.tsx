import type { Workspace } from "@/features/food-logging/model";
import { sum } from "@/features/nutrition/engine";
import { formatNumber } from "../format";
import type { FoodAction } from "../types";
import { savedChangeLabels } from "../action-labels";
import styles from "./voice-companion.module.css";

export function ConversationResult({
  workspace,
  change,
  openedVersion,
  busy,
  runAction,
}: {
  workspace: Workspace;
  change: { name: string; version: number } | null;
  openedVersion: number;
  busy: string;
  runAction: FoodAction;
}) {
  if (!change || change.version <= openedVersion || !savedChangeLabels[change.name]) return null;
  const meal = workspace.meals.find((item) => item.id === workspace.focusMealId);
  const logged = ["commit_food_log", "log_saved_meal"].includes(change.name);
  const operation = [...workspace.operations].reverse().find((item) => !item.undone);
  return (
    <div className={styles.receipt} role="status">
      <span className={styles.check} aria-hidden="true">
        ✓
      </span>
      <div>
        <strong>{savedChangeLabels[change.name]}</strong>
        <p>
          {logged && meal
            ? `${meal.name} · ${formatNumber(sum(meal.entries.map((entry) => entry.nutrients)).calories)} kcal`
            : "Your saved records are up to date."}
        </p>
      </div>
      {change.name !== "undo" && operation?.name === change.name && (
        <button disabled={!!busy} onClick={() => runAction("undo", { operationId: operation.id })}>
          Undo
        </button>
      )}
    </div>
  );
}
