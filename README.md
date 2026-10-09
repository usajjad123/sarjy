# Sarjy Fit

**Eat normally. Track effortlessly.** A voice-first nutrition dashboard with Gemini Live, USDA FoodData Central, anonymous browser memory and a structured Log → Correct → Undo → Remember workflow.

The itinerary product is preserved on the local `codex/sarjy-itinerary` branch at `135fd9d`. Nutrition work lives on `codex/sarjy-fit`. Its local database is separate; the old itinerary database stays intact.

## Run locally

```sh
npm install
cp env.example .env.local # Fill in keys; preserve an existing .env.local instead if present.
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open http://127.0.0.1:3001. Gemini needs `GEMINI_API_KEY` with access to the configured Live model. Food lookup uses `USDA_API_KEY`; development falls back to USDA's official, heavily rate-limited `DEMO_KEY`. A real key is required in production. Keys only run on the server; the browser gets a short-lived constrained Gemini token.

Configure `DATABASE_URL` to use PostgreSQL. Development without it uses a durable local SQLite database in `.data/sarjy-fit.db`. Production refuses local fallback. Both adapters execute the same validated commands with a compare-and-swap SQL update. Anonymous guests have a random HttpOnly SameSite cookie; they don't need accounts, and data is isolated by that cookie. Clearing cookies loses access; this isn't cross-device identity.

## Working increment

- Streaming Gemini voice, interruptions, live captions, stable audio-reactive avatar and text fallback.
- Daily calorie/macronutrient totals, editable targets, historical diary, browser timezone and manual quantity changes.
- A persisted multi-food draft: resolve USDA foods, resolve preparation/portions, validate all items, atomically commit.
- Server calculations and source references on every entry. Unknown nutrients/conversions never become fabricated zeros or grams.
- Corrections, removal, undo, personal memories, reusable meals, confirmed food library and copying historical meals.
- Version conflicts, tool cancellation recovery, idempotency keys and committed batch deduplication.
- Drafts survive unrelated conversation, failed lookup and refresh. Intake totals exclude drafts.

## Boundaries

`features/nutrition/engine.ts` owns units and arithmetic. `features/food/usda.ts` searches SR Legacy/Foundation records and normalizes exact nutrient IDs/units. `features/food-logging/model.ts` is the pure state/command reducer; `store.ts` handles guest identity, persistence, limits and atomic version checks. `/api/food-action` is the only mutation endpoint. Gemini proposes commands; it cannot submit its own nutrient numbers. Voice and manual UI edits use identical validation and server state.

The first database increment stores each guest's domain document in a PostgreSQL table (text JSON plus a version), rather than a fully normalized relational schema. One conditional update atomically commits the meal, nutrient snapshots, operations, focus and idempotency keys. This is intentionally small for the demo. Normalizing large histories and adding explicit schema migrations is a later production step. Undo retains the latest 20 intake/memory operations as before snapshots; undo clears the current draft to avoid applying it against restored state.

Food definitions and logged entries are separate snapshots. Replacing a usual meal never rewrites past consumption. Serving conversions need USDA gram weights; US volume units convert using standard ml factors disclosed in the portion label. Pieces with multiple sizes require an explicit portion ID. Real-world composition still varies: verified source data is not a claim of perfect individual-meal accuracy.

Food matching and reference interpretation are Gemini decisions guided by tool context. The deterministic reducer guarantees validated IDs/quantities and database consistency, but cannot guarantee every natural-language interpretation is correct. Automated scenarios test command/state behavior, not a claim of measured LLM accuracy.

Retries of the same command key or commit batch cannot duplicate intake. A newly spoken, distinct request can create another meal; semantic duplicate detection across separate user turns is not implemented. Read state after interrupted or uncertain commits before retrying.

## Why FoodData Central

FoodData Central provides authoritative generic food records with preparation distinctions, nutrient values and portion weights. It makes the tracker useful while keeping calculations and source attribution outside the language model. The assistant can resolve a user's description conversationally and the server can calculate an editable, traceable food record. [USDA API guide](https://fdc.nal.usda.gov/api-guide/).

## Validation

```sh
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build -- --webpack
node scripts/smoke-api.mjs # With the dev server running; creates isolated test guest records.
```

40 representative deterministic workflow scenarios plus 5 existing audio/animation tests. API smoke checks live USDA resolution, exact quantity correction, undo, memory, retries, stale updates, guest isolation and origin checks. It prints per-command latency. Voice-to-commit success rates and resolution accuracy need a repeated live evaluation set; the 10-second logging target is not yet measured or achieved.

## Next increments / deployment

Connect real USDA credentials and a hosted PostgreSQL `DATABASE_URL`, validate that adapter against a live database, then deploy on Vercel with those values plus `GEMINI_API_KEY`. Production build passes; there is no public deployment yet. Use HTTPS for microphone access. Do not deploy with the development demo key or ephemeral filesystem storage.

Conversation captions currently last for the active browser page/session; logged food, preferences, saved meals and pending workflows persist in the database. Labels/photo extraction, meal-image estimation, medical advice, weight tracking and unsolicited coaching are outside this increment. No label upload is implemented.

See [demo walkthrough](docs/DEMO.md) and [full product specification](docs/SARJY-FIT-SPEC.md).
