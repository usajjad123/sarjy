# Sarjy Fit demo

Local instance: http://127.0.0.1:3001. No signup. A real USDA key avoids the tiny shared demo quota.

1. Say or type: “Log lunch for today: 200 grams of chicken breast, cooked and roasted, and 150 grams of white long-grain rice, cooked.” The persisted draft shows the resolved records; only the final atomic commit updates daily totals.
2. “Actually, make the chicken 180 grams.” The existing food ID remains unchanged and server totals recalculate.
3. “Undo that.” The actual before snapshot restores 200 grams.
4. “Remember this as my usual lunch.” A reusable meal definition is saved.
5. Reload, reconnect, and say “Log my usual lunch.” Recorded foods/quantities need no new USDA lookup.
6. “How much protein have I eaten today?” Sarjy reads the database total.
7. “I ate three eggs.” Resolve preparation and USDA size if ambiguous. Ask an unrelated question, then reload: the pending food draft still exists and no incomplete food contributes calories.
8. Inspect the food source link, edit a portion manually, remove an item and undo. Library/memory panels let you inspect and forget saved definitions/preferences.

## Deep dive: multistep workflows

`start_food_log → search_food/use_saved_food → resolve_food → set_pending_quantity → commit_food_log`

The draft is explicit persisted state, not a chat inference. Every item must have a verified food and convertible positive quantity. Commit snapshots all nutrients, logs the whole batch, sets correction focus and records undo/idempotency state in one version-checked database update. Tool results drive UI updates and success confirmations.

Corrections use exact entry IDs; “actually two” refers to the one focused entry when unambiguous. Multi-food ambiguity requires a focused question. API failure preserves the draft. Cancellation can race a server commit, so the assistant must reread before retrying. Different operations concurrent with UI edits get a conflict instead of silently overwriting.

## Code tour

- `src/features/nutrition/engine.ts`: deterministic conversions, calculations, aggregation and local dates.
- `src/features/food/usda.ts`: USDA search/detail normalization, missing-value rejection and cache.
- `src/features/food-logging/model.ts`: draft, command reducer, snapshots, focus and undo.
- `src/features/food-logging/store.ts`: PostgreSQL/local adapters, guest ownership and atomic version checking.
- `src/app/api/food-action/route.ts`: validation, lookup orchestration and authoritative responses.
- `src/lib/realtime/gemini/config.ts`: response/clarification/action policy and constrained tools.
- `src/lib/realtime/gemini/GeminiLiveProvider.ts`: streaming audio, serialized tools, cancellation and UI synchronization.
- `tests/nutrition-workflows.test.mjs`: 40 deterministic representative scenarios.

## Be candid

USDA data does not guarantee perfect matching. AI matching decisions still need evaluation. The database is a domain document rather than normalized food tables. The hosted PostgreSQL adapter/public URL need real credentials and live validation. Conversation history is not yet server-persisted. Label uploads are phase 2. The latency target needs measurement under real voice conditions.
