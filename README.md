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

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to use Supabase Auth, PostgreSQL and private Storage. Sarjy creates an anonymous authenticated identity automatically, keeps session cookies HttpOnly and refreshes/verifies them in API Route Handlers. Food logs, drafts, goals, memories and reusable foods/meals are attached to that user; no signup screen is needed. Clearing cookies loses access to that anonymous identity. Account linking and cross-device recovery are future work.

Apply `supabase/migrations/202610090001_sarjy_identity.sql` in your project's SQL editor and enable **Allow anonymous sign-ins** in Auth settings. Alternatively, a server-only `SUPABASE_ACCESS_TOKEN` can run the setup below. That token is used only by the management script; the running app uses the publishable key and each user's verified session. A `DATABASE_URL` is not required with Supabase.

```sh
node scripts/supabase-admin.mjs inspect
node scripts/supabase-admin.mjs enable-anonymous
node scripts/supabase-admin.mjs migrate
node scripts/supabase-admin.mjs verify
```

The `sarjy-labels` bucket is private, accepts PNG/JPEG/WebP up to 8 MB and restricts objects to their owner's UUID folder. Upload/extraction UI is not implemented yet. Development imports an existing browser's local SQLite record once, keeps the original backup and prevents another identity from claiming the same import. Initial requests share the session bootstrap so React's development effect replay cannot create competing accounts.

Without Supabase, `DATABASE_URL` selects the legacy PostgreSQL adapter. Development without either uses `.data/sarjy-fit.db`; production refuses filesystem fallback. Use one configured adapter consistently.

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

Supabase stores each user's domain document as JSONB plus a version in `sarjy_workspaces`. Row-level security allows only that authenticated user to read their state. Direct table writes are denied; transactional RPCs derive the owner from `auth.uid()`, lock the row, check versions and replay keys, and commit the complete next state atomically. The app's reducer validates commands and calculates nutrition before this commit. This document model keeps a multistep workflow atomic; normalizing large histories is future work. Undo retains the latest 20 intake/memory operations as before snapshots; undo clears the current draft to avoid applying it against restored state.

Food definitions and logged entries are separate snapshots. Replacing a usual meal never rewrites past consumption. Serving conversions need USDA gram weights; US volume units convert using standard ml factors disclosed in the portion label. Pieces with multiple sizes require an explicit portion ID. Real-world composition still varies: verified source data is not a claim of perfect individual-meal accuracy.

Food matching and reference interpretation are Gemini decisions guided by tool context. The deterministic reducer guarantees validated IDs/quantities and database consistency, but cannot guarantee every natural-language interpretation is correct. Automated scenarios test command/state behavior, not a claim of measured LLM accuracy.

Retries of the same command key or commit batch cannot duplicate intake. A newly spoken, distinct request can create another meal; semantic duplicate detection across separate user turns is not implemented. Read state after interrupted or uncertain commits before retrying.

## Why FoodData Central

FoodData Central provides authoritative generic food records with preparation distinctions, nutrient values and portion weights. It makes the tracker useful while keeping calculations and source attribution outside the language model. The assistant can resolve a user's description conversationally and the server can calculate an editable, traceable food record. [USDA API guide](https://fdc.nal.usda.gov/api-guide/).

## Validation

```sh
npm run format # Format TypeScript, JSX, CSS, scripts and tests with two-space indentation.
npm run format:check
npm test
npm run lint
npx tsc --noEmit
npm run build -- --webpack
node scripts/smoke-api.mjs # With the dev server running; creates isolated test guest records.
node scripts/test-supabase.mjs # Live Auth/RLS/RPC/private-image checks using two new test users.
```

55 automated cases cover nutrition workflows, audio/animation behavior and session bootstrap. Regression cases include changing a draft's food search, adding to historical meals, keeping timezone settings during undo, rejecting malformed USDA conversions, requiring explicit confirmation before replacing a usual meal and preserving newer manual changes when a voice response arrives late. API smoke checks live USDA resolution, exact quantity correction, undo, memory, retries, stale updates, user isolation and origin checks. Supabase checks cover legacy import ownership, concurrent commits, authenticated ownership of images and forged-cookie rejection. Test scripts create isolated fixture accounts/records; the image check removes only its own temporary image. The API script prints per-command latency. Voice-to-commit success rates and resolution accuracy need a repeated live evaluation set; the 10-second logging target is not yet measured or achieved.

## Next increments / deployment

USDA credentials and live Supabase Auth/database/private Storage are connected and verified locally. Next, implement label uploads and user-defined foods, then deploy on Vercel with the two public Supabase settings, `USDA_API_KEY` and `GEMINI_API_KEY`. The deployment does not need `SUPABASE_ACCESS_TOKEN`. There is no public deployment yet. Use HTTPS for microphone access. Before public anonymous signup, configure abuse protection (Supabase recommends CAPTCHA/Turnstile); current per-user limits protect commands and Gemini token creation but do not prevent mass signup.

Conversation captions currently last for the active browser page/session; logged food, preferences, saved meals and pending workflows persist in the database. Labels/photo extraction, meal-image estimation, medical advice, weight tracking and unsolicited coaching are outside this increment. No label upload is implemented.

See [demo walkthrough](docs/DEMO.md) and [full product specification](docs/SARJY-FIT-SPEC.md).
