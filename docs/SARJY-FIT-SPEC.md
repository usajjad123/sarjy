# Sarjy Fit — Implemented product and workflow contract

**Eat normally. Track effortlessly.** A voice-first nutrition tracker built around Log → Correct → Undo → Remember. Primary assignment deep dive: **Multistep Workflows**. The reactive avatar/dashboard supports that workflow.

This document describes the implemented behavior after the dashboard and code cleanup. It replaces the earlier aspirational plan. [README](../README.md) owns setup, verification commands and deployment status; [DEMO](DEMO.md) owns the presentation walkthrough.

## Product behavior

Users can speak, type or use forms to manage meals. Gemini handles language/food-reference interpretation and proposes tool calls; the server validates commands, calculates nutrition and saves the authoritative workspace. Success is based on completed saves, not the assistant's verbal claim.

The current nutrition scope is calories, protein, carbohydrates and fat. Default daily targets are 2,000 kcal, 120 g protein, 250 g carbs and 65 g fat; these are examples until the user configures targets. The assistant is instructed to be concise, passive by default and free of unsolicited diet judgment or medical claims. These are prompt policies, not an independently tested jailbreak-protection layer.

| Area          | Implemented behavior                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview      | Sarjy left; selected day's energy/macros/recent meals right; full diary below. Sarjy first on mobile.                                                                                                      |
| Conversation  | Same mounted companion expands using Motion; explicit open/close state prevents pauses from switching views. Back/Escape preserves session and mic state; End disconnects.                                 |
| Accessibility | Shared modal focus trap/restoration, background inert state, Escape, scroll locking and reduced-motion expansion. Custom calendar has keyboard navigation.                                                 |
| Diary         | Initially collapsed meal cards show food count and all four nutrient totals; expanded content shows food portions, source links, edit/remove and save-meal controls.                                       |
| Dates         | Day arrows and central calendar with month controls/record markers. Manual logging uses selected date. Voice resolves dates from saved timezone/today or the request, independently of calendar selection. |
| Draft         | One persisted multi-food draft, candidate choices, quantity validation, previews, manual commit/cancel. Incomplete drafts never count as intake.                                                           |
| Library       | Confirmed USDA foods collected on commit; saved meals can be logged/forgotten. Reusing foods through voice avoids lookup. No custom-food authoring.                                                        |
| Memory        | Explicit key/value facts, editable by replacing the same key and forgettable in UI/chat; goals and timezone have dedicated settings. No automatic conversation summaries/highlights.                       |
| Export        | Complete workspace downloaded as JSON. No JSON import.                                                                                                                                                     |

## Response, clarification and action

The Gemini system instruction distinguishes three behaviors:

1. **Respond:** ordinary conversation and known preferences can be answered directly. Read fresh authoritative context before intake totals, edits, undo and recalling meals. Refresh personal facts quietly only when needed; do not narrate memory retrieval.
2. **Clarify:** ask one focused question when preparation, amount, portion size, date or reference materially changes correctness. For an intake request, first persist known details in a draft; unknown quantities remain missing.
3. **Act:** call structured tools for requested changes. For food actions, speak a short acknowledgment while work runs, then confirm after the relevant successful result. Never invent nutrient values, IDs or conversion weights.

These choices and matching decisions are LLM behavior guided by context/instructions. Deterministic checks enforce valid state transitions, quantities, candidate IDs and save consistency; they cannot guarantee that natural language was interpreted correctly.

## Logging and recovery

```text
Intake request → start_food_log
  → search_food → resolve_food, or use_saved_food
  → set_pending_quantity if clarification is needed
  → commit_food_log → authoritative workspace → UI + voice confirmation
```

Only one draft can be active. It stores batch/item IDs, date, meal name, optional existing meal ID, food queries, candidates, selected food, quantity and validation issue. Tool dependencies must use returned IDs/results; the client queues tool execution, and the prompt tells Gemini to await dependent steps.

`commit_food_log` requires the active batch ID and every item to be resolved. It creates/adds to a meal atomically, snapshots food/portion/nutrients, registers confirmed foods, sets correction focus and records undo/batch metadata. Adding to an existing meal preserves that meal's date. A quantity correction uses `update_quantity` on the existing entry; draft corrections use `set_pending_quantity`. Removal uses `remove_entry`. Empty meals can remain after their last entry is removed and cannot be saved as reusable meals.

Draft state survives reloads, unrelated questions and lookup failure. `cancel_pending` explicitly discards it. Canceling a network/tool request does not prove the database did not commit: reread before retrying. Stale writes get HTTP 409; clients refresh state and reconsider instead of silently overwriting. Older responses cannot replace newer UI state. There is no automatic Live-session resumption; an ended/error session requires a new connection.

Undo restores the latest non-undone operation's before snapshot, clears the active draft and preserves the current timezone. Draft steps/cancellation and timezone changes are untracked. Intake edits, reusable-food/meal changes, goals and memory changes are tracked. Up to 20 operation records are retained. Historical nutrient snapshots stay unchanged when a saved definition is replaced or forgotten.

## API and commands

| Endpoint                          | Behavior                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/workspace?timezone=...` | Verify/create identity, load/initialize workspace, optionally set initial timezone at version 0. Returns workspace, storage kind and food-lookup status. |
| `POST /api/food-action`           | Read nutrition context or execute a validated command; returns authoritative workspace/context. All user-requested nutrition/memory edits pass here.     |
| `POST /api/realtime-token`        | Constrained, single-use main-session token plus config and saved context/workspace.                                                                      |
| `POST /api/transcription-token`   | Constrained, single-use interim-transcription token and config. Shares the voice-token rate-limit scope.                                                 |

Mutation requests use the actual wire envelope:

```json
{
  "name": "update_quantity",
  "args": {
    "entryId": "<saved-entry-id>",
    "quantity": { "amount": 180, "unit": "g" }
  },
  "expectedVersion": 12,
  "callId": "<unique-retry-id>"
}
```

`get_nutrition_context` needs only `name` and `args` (optional `date`). Other commands require an integer version and a call ID of 1–200 characters. An already-applied call ID returns current state before checking stale version. Responses may describe a persisted **draft**; HTTP success alone is not proof that intake was logged.

Exposed action names are:

- Read: `get_nutrition_context`.
- Draft: `start_food_log`, `search_food`, `resolve_food`, `use_saved_food`, `set_pending_quantity`, `commit_food_log`, `cancel_pending`.
- Intake: `update_quantity`, `remove_entry`, `undo`.
- Reuse: `save_meal`, `log_saved_meal`, `copy_meal`, `forget_saved_meal`, `forget_food`.
- Settings/memory: `set_goals`, `set_timezone`, `remember_fact`, `forget_fact`.

`set_timezone` is a UI/server command rather than a Gemini-declared tool. `set_candidates` is reducer-internal: the route derives it from USDA search results. Nutrient data for `resolve_food` comes from the server fetch; callers cannot submit their own numbers through the food-action API. The shared `Action` type is `{ name: string; args: Record<string, unknown> }`, validated at runtime.

## Nutrition contract

USDA search is restricted to SR Legacy and Foundation, up to eight candidates per query. Selected records retain provider, FDC ID, data type, source URL and fetch timestamp. Successful lookup results have a 24-hour process-local cache; requests time out after 12 seconds. Cache is not shared across deployed instances.

The normalizer requires valid kcal energy and gram values for protein/carbs/fat. Missing/malformed nutrients are rejected, including incorrect units; genuine recorded zero values are allowed. Calculations use `per100g × grams / 100`, aggregate unrounded values and round only for presentation.

Quantities support `g`, `ml`, `piece` and `serving`, with amount and converted grams between 0.01 and 10,000. Grams need no portion. Other units require a matching verified USDA conversion; multiple choices need an exact portion ID. Eligible cup/tablespoon/teaspoon labels use US ml factors disclosed in the generated portion label. Invalid portion weights and heaped-volume conversions are excluded. Unsupported density never becomes `1 ml = 1 g`. Food preparation/matching remains an AI/user selection, not an algorithmic accuracy guarantee.

## Identity, storage and state

Supabase Auth creates a real anonymous authenticated user with verified HttpOnly cookies. There is no signup/login UI, email flow or account linking. The same browser session can return to its data; clearing cookies or using another device has no recovery path. Local-only development uses a UUID guest cookie and SQLite. Production refuses SQLite fallback. The empty workspace defaults to `Asia/Riyadh`; initial dashboard loading sets the browser timezone while version is 0. Later timezone changes preserve the original civil dates on historical meals.

`Workspace` contains `version`, `goals`, `goalsConfigured`, `timezone`, `meals`, `savedMeals`, confirmed `foods`, explicit `memories`, `focusMealId`, `focusEntryId`, `pending`, `operations`, `appliedCalls` and `committedBatches`. Each consumed entry snapshots its food, quantity, gram weight and calculated nutrients. User ownership belongs to the database row, rather than an editable workspace field. Full conversation messages are not part of this document.

| Supabase object              | Purpose                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `sarjy_workspaces`           | One JSONB document/version/timestamp per Auth user.                                    |
| `sarjy_rate_limits`          | Per-user/per-scope minute buckets shared across server instances.                      |
| `sarjy_legacy_imports`       | One-time ownership of old local records; local source file is preserved.               |
| `initialize_sarjy_workspace` | Initialize once; protect legacy-import ownership.                                      |
| `commit_sarjy_workspace`     | Derive user from JWT, lock row, check retry/version and atomically save next document. |
| `consume_sarjy_rate_limit`   | Enforce actions 120/minute and voice-token requests 12/minute per user.                |

RLS allows authenticated users to read only their workspace; direct table writes and unauthenticated RPC execution are denied. RPCs are callable by authenticated users for their own document. They enforce ownership, versions/retry IDs and basic document constraints; they do not independently validate the full nutrition schema. App-level limits/validation are consequently not a tamper-proof SQL-level nutrition contract. No service-role key, ORM, vector database, external queue or image storage is used.

The reducer limits each draft to 12 items, meals to 2,000, saved meals to 100, confirmed foods to 300 and memories to 50. It retains 200 command IDs and 200 committed batch IDs. Duplicate protection applies within these retained windows, not forever or across distinct newly spoken requests. Memory keys allow 60 characters and values 500; updates replace the normalized key. Saves have an 8,000,000-length guard (app JSON string length; Supabase RPC JSON text bytes). Large histories/undo snapshots can hit that guard before entity limits.

POST handlers reject a provided Origin whose host differs from the request Host; this is not a requirement that every client supply Origin. User command JSON is limited to 30,000 characters. Rate limits apply to food-action requests and token creation, not every workspace read. They do not prevent mass anonymous signup or limit ongoing audio usage in an established session.

## Voice, audio and captions

The configured main model is `gemini-3.8-live`, with audio responses plus input/output transcription. A single-use token must start a new session within one minute and expires after 30 minutes. Interim input uses `gemini-3.5-transcribe-live`, with the same start window and a 10-minute token expiry. These are token constraints, not measured/guaranteed WebSocket durations.

`GeminiLiveProvider` captures microphone audio through the required browser-loaded `public/audio-processor.js` AudioWorklet (1,024 Float32 samples per batch), converts it to PCM16/base64 and sends it to the main and optional transcription sessions. Input requests a 16 kHz AudioContext and uses its actual sample rate; output plays 24 kHz PCM. Main-model interruption messages stop queued playback. Local speech hysteresis stabilizes user visual activity without gating mic data. Assistant visual activity follows queued playback/turn state so silent packets do not restart the avatar.

The optional transcriber runs only while the microphone is enabled; failure closes it and shows delayed-caption fallback. Interim hypotheses replace prior text and do not enter conversation history or mutate food records. Main-model transcription supplies the conversation transcript. Assistant caption chunks accumulate per turn. Captions are plain text; estimated word highlighting and playback timing estimates were removed.

Tools are declared `NON_BLOCKING` and results use `WHEN_IDLE`; audio may play while requests run. The client serializes requests, checks generation/cancellation and uses session/tool IDs for retry keys. UI writes update live context without requiring an assistant reply. A successful result determines saved state; spoken acknowledgment does not.

## Implemented scope and validation limits

The current 66 automated tests include 46 nutrition cases and coverage for calendar dates, SQLite, workspace bootstrap, transcription and speech/playback/tool state. Live USDA/app and Supabase/Auth/RLS scripts exist separately. Test fixtures are not measured natural-language conversations. Detailed commands and previously completed live/browser checks are in the README.

Not implemented: signup/login/recovery, full conversation persistence or automatic highlights, custom/packaged-food authoring, nutrition-label upload/extraction, meal-photo estimation, weight/fitness tracking, automated coaching and normalized long-history storage. No generic voice-provider abstraction remains; only Gemini is implemented.

Still to measure/verify: repeated voice workflow success, food-match accuracy, clarification frequency, first-audio/end-to-end latency, long-session reliability and unrestricted reviewer access. Under-10-second meal logging remains an unmeasured target. Label functionality is deferred and no storage migration is included. Future scope is not a claim of shipped behavior.
