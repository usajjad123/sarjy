import type { Workspace } from "@/features/food-logging/model";
import type { FoodAction } from "../types";
export function PersonalMemory({
  workspace,
  busy,
  runAction,
  onAddMemory,
}: {
  workspace: Workspace;
  busy: string;
  runAction: FoodAction;
  onAddMemory: () => void;
}) {
  return (
    <section className="memory-section">
      <div className="section-heading">
        <h2>Your preferences</h2>
        <button className="secondary" onClick={() => onAddMemory()}>
          + Remember something
        </button>
      </div>
      <p className="section-description">
        Only facts you ask Sarjy to remember. Updating a key replaces that preference.
      </p>
      {!workspace.memories.length && (
        <div className="empty-card">
          “Remember that I prefer grams and usually eat 150g of yogurt.”
        </div>
      )}
      {workspace.memories.map((memory) => (
        <article className="memory-row" key={memory.key}>
          <span>✳</span>
          <div>
            <h3>{memory.key.replaceAll("_", " ")}</h3>
            <p>{memory.value}</p>
          </div>
          <button
            className="text-button"
            disabled={!!busy}
            onClick={() => runAction("forget_fact", { key: memory.key })}
          >
            Forget
          </button>
        </article>
      ))}
      <div className="timezone-card">
        <h3>Your diary timezone</h3>
        <p>Dates follow your local day. Previous logs keep their original date.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction("set_timezone", {
              timezone: new FormData(e.currentTarget).get("timezone"),
            });
          }}
        >
          <input
            aria-label="IANA timezone"
            name="timezone"
            defaultValue={workspace.timezone}
            placeholder="Asia/Riyadh"
          />
          <button className="secondary" disabled={!!busy}>
            Save
          </button>
        </form>
      </div>
    </section>
  );
}
