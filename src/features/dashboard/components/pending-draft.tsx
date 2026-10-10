import type { Pending, PendingItem } from "@/features/food-logging/model";
import { calculate, type Nutrients } from "@/features/nutrition/engine";
import type { FoodAction } from "../types";
import { formatNumber } from "../format";
import { Icon } from "./icon";
import { QuantityForm } from "./quantity-form";
export function PendingDraft({
  pending,
  busy,
  runAction,
}: {
  pending: Pending;
  busy: string;
  runAction: FoodAction;
}) {
  return (
    <section className="pending-card" aria-labelledby="draft-title">
      <div className="section-heading">
        <div>
          <p className="fit-eyebrow">RESOLVE → CHECK → LOG</p>
          <h2 id="draft-title">Let’s get the details right.</h2>
          <p>
            {pending.mealName} · {pending.date} · This is a draft, not logged intake.
          </p>
        </div>
        <button
          className="text-button"
          disabled={!!busy}
          onClick={() => runAction("cancel_pending", {})}
        >
          Cancel draft
        </button>
      </div>
      {pending.items.map((item) => (
        <PendingRow key={item.id} item={item} busy={!!busy} runAction={runAction} />
      ))}
      <div className="draft-footer">
        <span>All foods save together. No partial meal.</span>
        <button
          className="primary"
          disabled={
            !!busy || pending.items.some((item) => !item.food || !item.quantity || item.issue)
          }
          onClick={() => runAction("commit_food_log", { batchId: pending.id })}
        >
          {busy === "commit_food_log" ? "Logging…" : "Log this meal"}
          <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}
function PendingRow({
  item,
  busy,
  runAction,
}: {
  item: PendingItem;
  busy: boolean;
  runAction: FoodAction;
}) {
  let preview: Nutrients | null = null;
  try {
    if (item.food && item.quantity && !item.issue) {
      preview = calculate(item.food, item.quantity).nutrients;
    }
  } catch {
    /* The server keeps invalid portions in the draft until clarified. */
  }
  const ready = preview !== null;
  return (
    <article className={`pending-item ${ready ? "ready" : ""}`}>
      <div className="pending-item-heading">
        <span className="draft-check">{ready ? "✓" : "○"}</span>
        <div>
          <h3>{item.query}</h3>
          <p>
            {item.food
              ? item.food.name
              : `${item.quantity ? `${formatNumber(item.quantity.amount)} ${item.quantity.unit} · ` : "Quantity not set · "}Needs a verified food match`}
          </p>
        </div>
        {!item.food && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => runAction("search_food", { itemId: item.id })}
          >
            {busy ? "Working…" : item.candidates.length ? "Search again" : "Find USDA matches"}
          </button>
        )}
      </div>
      {!item.food && item.candidates.length > 0 && (
        <div className="candidate-list">
          {item.candidates.map((candidate) => (
            <button
              disabled={busy}
              key={candidate.fdcId}
              onClick={() => runAction("resolve_food", { itemId: item.id, fdcId: candidate.fdcId })}
            >
              <span>
                {candidate.name}
                <small>
                  {candidate.dataType} · USDA {candidate.fdcId}
                </small>
              </span>
              <span>＋</span>
            </button>
          ))}
        </div>
      )}
      {item.issue && <p className="draft-issue">{item.issue}</p>}
      {item.food && (
        <QuantityForm
          food={item.food}
          initial={item.quantity}
          busy={busy}
          submitLabel="Check portion"
          onSubmit={(quantity) => runAction("set_pending_quantity", { itemId: item.id, quantity })}
        />
      )}
      {preview && (
        <p className="draft-preview">
          Verified · {formatNumber(preview.calories)} kcal · {formatNumber(preview.protein)} g
          protein
        </p>
      )}
    </article>
  );
}
