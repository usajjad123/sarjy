# Sarjy Fit

**Eat normally. Track effortlessly.** A voice-first nutrition tracker with Gemini Live, USDA FoodData Central and persistent anonymous-user records. The main workflow is **Log → Correct → Undo → Remember**; the database is the source of truth for intake and memory.

Nutrition work lives on `codex/sarjy-fit`. The itinerary prototype is preserved locally on `codex/sarjy-itinerary` at `135fd9d`, with its original database intact.

## Run locally

Use Node.js 22 (the runtime used for validation) and npm.

```sh
npm install
# Only create this file if you do not already have one:
cp env.example .env.local
# Fill in the settings below before starting:
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open [the local instance](http://127.0.0.1:3001). Manual logging works without Gemini; voice and typed conversation both use Gemini Live. Typing does not require microphone permission. Microphone access requires localhost or HTTPS and browser permission.

| Setting                                | Purpose                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                       | Server-only key for constrained Live tokens. The configured conversation model is `gemini-3.8-live`; interim captions use `gemini-3.5-transcribe-live`. |
| `USDA_API_KEY`                         | Server-only FoodData Central key. Development uses the limited `DEMO_KEY` if omitted; production has no demo fallback.                                  |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL.                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; required with the URL for Supabase storage. It is a public setting, not a privileged secret.                                  |
| `SUPABASE_ACCESS_TOKEN`                | Optional, local management token for the setup script only. Never deploy it.                                                                            |

The Gemini account must have access to the configured models. The browser receives constrained ephemeral tokens, never the Gemini or USDA API key. Without both Supabase settings, development uses `.data/sarjy-fit.db`. Omit both placeholder settings if using this local fallback. Production requires Supabase and refuses filesystem storage.

## Supabase setup and identity

Apply [the migration](supabase/migrations/202610090001_sarjy_identity.sql) in the project's SQL editor and enable **Allow anonymous sign-ins** in Auth settings. Alternatively, put a management token in `.env.local` and run:

```sh
node scripts/supabase-admin.mjs inspect
node scripts/supabase-admin.mjs enable-anonymous
node scripts/supabase-admin.mjs migrate
node scripts/supabase-admin.mjs verify
```

The script targets the project in `NEXT_PUBLIC_SUPABASE_URL`. `verify` reports anonymous-auth configuration and table/RLS presence; use the live tests below to exercise permissions and transactional behavior.

The app creates an anonymous authenticated identity automatically. API Route Handlers verify/refresh its HttpOnly session cookies. Meals, drafts, goals, preferences and reusable foods/meals belong to that identity. They persist across reloads and later visits in the same browser while its session remains available. Clearing cookies loses access; signup, login, account linking and cross-device recovery are not implemented. SMTP is not used.

When moving local development records to Supabase, the old `sarjy_guest` cookie identifies a one-time, read-only SQLite import. The original database remains intact; import ownership prevents another identity from claiming the same import. Hosted deployments do not import files from the local machine. The browser shares its initial workspace request to avoid competing identities during React development effect replay.

## Current experience

- Sarjy occupies the left half of the desktop overview; date navigation, daily energy, macros and recent meals occupy the right. The full diary sits below. Mobile puts Sarjy first, with sticky voice controls.
- Talk to Sarjy expands the same mounted companion into a focused conversation using Motion. Back to my day/Escape preserves the session **and the microphone's current state**; End conversation disconnects. Pauses do not change views. Reduced-motion settings disable the expansion animation.
- Meals start collapsed, showing food count, calories, protein, carbs and fat. Expand one for food names, portions, USDA links, quantity edits, removal and Remember meal.
- Previous/next-day controls surround a custom date picker with month navigation, logged-day markers and keyboard support. Manual logging uses the selected diary date; voice logging needs its own date context or an explicit date in the request.
- Voice or manual logging creates a persisted draft. Resolve food/preparation and portions, then save every item together. Unresolved drafts do not affect daily intake. Errors, refreshes and unrelated conversation preserve the draft.
- Correct/remove/undo, configurable targets, reusable meals, confirmed USDA foods, editable key/value preferences, timezone settings and JSON export are available. JSON import is not implemented.

Logging, portion edits, removal, undo and remembering a meal show confirmation cards in the expanded view. Sarjy is instructed to give a brief acknowledgment for food actions while tools run, then confirm only after success. Known preferences are recalled naturally; context reads and memory tools are kept out of the visible progress label. These conversational choices are model instructions, not deterministic guarantees.

Captions show actual incoming transcription as plain text. Estimated word highlighting was removed. A second transcription-only connection shares mic audio while the microphone is enabled, adding Gemini usage. Its token expires after 10 minutes; no client timer guarantees that socket lifetime. If caption setup/streaming fails or closes, conversation continues with finalized captions and a visible fallback notice. Mic off closes the caption connection. Assistant text accumulates per turn and resets on the next reply/interruption.

Conversation text is held in React state: Back preserves it, starting a new connection clears it, and a page reload loses it. Saved preferences and food/workflow records persist separately; full conversations and automatic conversation highlights are not stored.

## Architecture and reliability

The implemented stack is Next.js 16.4 App Router, React 19.3 with React Compiler, TypeScript, Tailwind CSS 4 plus CSS modules, Motion, `bot-avatars`, Gemini's SDK and Supabase Auth/PostgreSQL. Local development uses `@libsql/client` for SQLite. There is no ORM, Zustand store or generic voice-provider interface.

- `src/app/page.tsx` renders the dashboard. `src/features/dashboard/` contains focused components, calendar helpers and `use-diary-workspace.ts` for loading/version checks/manual actions.
- `src/features/food-logging/model.ts` is the pure command reducer; `store.ts` handles verified ownership, persistence and request limits. Voice and UI send commands to `/api/food-action`.
- `src/features/food/usda.ts` searches SR Legacy/Foundation records and fetches verified nutrients/portions. `src/features/nutrition/engine.ts` performs conversions and arithmetic.
- `src/lib/realtime/gemini/` owns session configuration, streaming audio, ordered tools, playback and interim transcription. `public/audio-processor.js` is required: the browser loads it as an AudioWorklet to batch microphone samples.
- `src/components/sarjy-avatar.tsx` uses playback activity and spring-smoothed levels. Local speech detection stabilizes visual state; it does not filter audio sent to Gemini or guarantee noise-free barge-in.
- `src/components/modal.tsx` and `src/hooks/use-modal-focus.ts` share focus trapping, Escape and focus restoration with the expanded conversation.

Supabase has three tables: the versioned JSONB workspace, per-user request limits and legacy-import ownership. Three RPCs initialize, commit and consume limits. RLS restricts workspace reads; direct table writes are denied. Commit derives ownership from `auth.uid()`, locks the row and checks versions/retry IDs. The server reducer validates nutrition before saving. Authenticated users can also invoke these RPCs on their own document; SQL enforces ownership/save consistency, not complete nutritional validation. No storage bucket or image policies are included in the migration; any older bucket is left untouched.

Food definitions and consumed entries are separate snapshots. Updating/forgetting a reusable meal does not rewrite historical intake. Non-gram units need verified USDA portion weights; ml never defaults to grams. Missing nutrients/conversions are rejected rather than fabricated. The last 20 tracked operations support snapshot-based undo, which clears the pending draft and preserves the current timezone.

Voice tools execute in order, with non-blocking declarations and `WHEN_IDLE` results so acknowledgments can play while work runs. Version checks protect against concurrent UI edits. Reusing a retained command ID or batch ID cannot duplicate intake; a distinct new request can log another meal. An interrupted request may have committed, so read fresh state before retrying. Natural-language food matching and reference resolution remain Gemini decisions and need live evaluation.

## Why FoodData Central

FoodData Central supplies generic food records with preparation distinctions, nutrient values and portion weights. It lets the server calculate editable, traceable records while Gemini handles the conversation. This separation avoids relying on generated calorie estimates. See the [USDA API guide](https://fdc.nal.usda.gov/api-guide/).

## Validation

```sh
npm run format:check
npm test
npm run lint
npx tsc --noEmit
npm run build -- --webpack
# With the development server running and keys configured:
node scripts/smoke-api.mjs
node scripts/test-supabase.mjs
```

`npm run format` formats application code, scripts, tests and root configuration; Markdown is checked separately with `npx prettier --check README.md docs/*.md`.

The current suite has **66 tests**, including 46 nutrition workflow cases, calendar/timezone handling, local storage, session bootstrap, captions, speech/playback stability, ordered tools, acknowledgment playback and stale-response protection. These exercise code/state behavior with fixtures; they are not 66 measured AI conversations. The API smoke script exercises live USDA lookup and app mutations and prints request timings. The Supabase script creates two anonymous users to test RLS, RPC retries/conflicts, import ownership, request limits and forged-cookie rejection. Both default to `http://127.0.0.1:3001`; `SARJY_TEST_URL` overrides the app URL. They leave isolated fixture accounts/records and do not clean them up automatically.

Prior cleanup validation included both live scripts, a real Gemini typed reply and desktop/mobile browser checks. Voice-to-first-audio, end-to-end voice logging latency, food-match accuracy and long-session reliability have not been systematically measured. The earlier under-10-second logging goal is an unmeasured target.

## Deployment and remaining scope

Vercel must use the Next.js framework and have the four runtime settings above in the intended environment: Gemini, USDA and the two public Supabase settings. Apply the database setup separately, then rebuild after changing environment values. HTTPS supports browser microphone access.

[Branch preview](https://sarjy-git-codex-sarjy-fit-usajjad123s-projects.vercel.app/): on 2026-10-10, Vercel reported cleanup commit `e93c61e` as READY, but an unauthenticated request redirected to Vercel login. Reviewer access without special setup still requires an accessible deployment/protection configuration. Build readiness alone does not verify live voice functionality.

Before opening anonymous signup publicly, configure signup abuse protection; per-user action/token limits do not stop mass account creation. Signup/login recovery, full conversation persistence, custom foods, nutrition-label uploads/extraction, meal-photo estimation, weight/fitness tracking, unsolicited coaching and a normalized long-history database are outside the current implementation.

See the [demo walkthrough](docs/DEMO.md) and [implemented product/workflow contract](docs/SARJY-FIT-SPEC.md).
