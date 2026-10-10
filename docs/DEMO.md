# Sarjy Fit demo

This walkthrough covers the current implementation. Use [the local instance](http://127.0.0.1:3001) after completing the [README setup](../README.md). No signup or SMTP is needed. Use a real USDA key and a Gemini key with access to the configured models. The branch preview currently requires Vercel authentication; check reviewer access before presenting.

## Signature demo: Log → Correct → Undo → Remember

1. Click **Talk to Sarjy** and allow microphone access, or **Prefer to type?** to open conversation without enabling the microphone. Typing sends through Gemini Live and Sarjy still responds with audio.
2. Say/type: “Log lunch for today: 200 grams of chicken breast, cooked and roasted, and 150 grams of white long-grain rice, cooked.” Sarjy should acknowledge while resolving foods. A persisted draft holds the USDA matches; daily totals change only after the whole meal commits. Successful meal updates appear as confirmation cards.
3. Choose **Back to my day** to inspect the updated dashboard. This preserves the connection and current mic state; turn the mic off if needed. Lunch is initially collapsed with calories/macros. Expand it to inspect portions and USDA sources.
4. Continue the conversation: “Actually, make the chicken 180 grams.” Check that the existing entry changes and totals recalculate; it should not create a second chicken entry.
5. “Undo that.” Confirm the portion returns to 200 grams using the operation's before snapshot.
6. “Remember this as my usual lunch.” Inspect the saved definition in the library. Replacing an existing name requires explicit confirmation.
7. **End conversation**, reload in the same browser and reconnect. “Log my usual lunch.” This intentionally adds another meal using saved snapshots/quantities without new USDA lookup. Historical consumption remains unchanged.
8. “How much protein have I eaten today?” Sarjy should read the saved total, including both logged meals.

Food selection and conversational wording are Gemini decisions. If it asks a necessary preparation/portion question, answer it; do not present exact wording or turn count as guaranteed.

## Memory, recovery and UI checks

- “Remember that my favorite color is blue.” Wait for confirmation, reload and ask “What's my favorite color?” Sarjy is instructed to answer naturally without narrating memory lookup. Inspect it in **Personal memory**; update the same key or use **Forget** to remove it. This proves saved facts, not full conversation storage.
- “Log three eggs for breakfast today.” If preparation/size is unresolved, inspect the pending draft: incomplete foods contribute no calories. Ask an unrelated question or reload, then continue from the draft. To make the ambiguity explicit, omit quantity: “Log cooked rice for dinner today.”
- Open **Add food** for the manual path: describe food/preparation, create a draft, select a returned USDA candidate and verified portion, then **Log this meal**. Edit/remove a logged food and use Undo. Voice and manual paths use the same endpoint/reducer.
- Use previous/next-day arrows and the middle date picker to inspect history. The picker marks logged days and supports arrow keys, Home/End, Page Up/Down and Escape. For historical voice logging, explicitly say the intended date; selecting a dashboard day does not change the voice session's date context.
- Inspect **Your usual meals**, **Confirmed foods**, goals and timezone settings. **Export my records** downloads the complete workspace as JSON; there is no import UI.
- Check narrow-screen layout: Sarjy appears first and expands to the viewport. Escape/Back returns to the dashboard; End disconnects. Reduced-motion settings disable the expansion animation.
- Captions display actual transcription updates with no word highlighting. If the interim-caption connection is unavailable, a visible notice indicates captions will arrive after the user's turn. This does not prevent the main conversation.

## Multistep workflow explanation

```text
start_food_log
  → search_food → resolve_food, or use_saved_food
  → set_pending_quantity when needed
  → commit_food_log
```

A draft persists known foods and quantities before clarification. Every item needs verified food and a convertible positive quantity. Commit snapshots all nutrients and saves the whole batch with focus, undo and retry metadata in one version-checked write. A successful tool result, rather than spoken text, drives saved state and UI confirmation.

Corrections address exact entry IDs. A single-food operation sets correction focus; multiple matching foods require clarification. USDA errors preserve the draft. Competing voice/UI edits produce conflicts rather than silent overwrites; the client refreshes state for reconsideration. Cancellation may race a completed save, so reread before retrying. Retry IDs/batch IDs are bounded; a newly requested meal is a distinct log.

## Code tour

| File                                                                              | Explain                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/app/page.tsx` and `src/features/dashboard/sarjy-dashboard.tsx`               | Thin route, focused dashboard composition and persistent companion expansion.  |
| `src/features/dashboard/use-diary-workspace.ts`                                   | Workspace loading, manual mutations and stale-version protection.              |
| `src/features/food-logging/model.ts`                                              | Explicit draft, pure command reducer, focus, snapshots and undo.               |
| `src/features/nutrition/engine.ts`                                                | Verified unit conversions, nutrient calculations and local dates.              |
| `src/features/food/usda.ts`                                                       | SR Legacy/Foundation search, nutrient/portion normalization and cache.         |
| `src/features/food-logging/store.ts` and `local-store.ts`                         | Verified Supabase identity/RPC persistence and development SQLite fallback.    |
| `supabase/migrations/202610090001_sarjy_identity.sql`                             | Three tables/RPCs for ownership, versioned saves, imports and limits.          |
| `src/app/api/food-action/route.ts`                                                | Command envelope validation and USDA lookup orchestration.                     |
| `src/lib/realtime/gemini/config.ts`                                               | Response/clarification/action instructions and constrained non-blocking tools. |
| `src/lib/realtime/gemini/GeminiLiveProvider.ts`                                   | Streaming playback, ordered tools, cancellation and UI synchronization.        |
| `public/audio-processor.js` and `src/lib/realtime/gemini/LiveInputTranscriber.ts` | Required microphone AudioWorklet and optional interim captions.                |
| `tests/nutrition-workflows.test.mjs`                                              | 46 deterministic workflow cases within the 66-test suite.                      |

## Be candid during presentation

Persistent memory is explicit key/value facts plus food/meal records; complete conversations are temporary. Anonymous identity is tied to the browser session and has no cross-device recovery. Supabase is a versioned JSONB document rather than normalized food tables; SQL protects ownership/save consistency, while nutrition validation lives in the app reducer. Users can invoke their own workspace RPCs, so do not claim independent SQL-level nutrient enforcement.

USDA provenance does not guarantee the AI selected the correct food or the real meal exactly matches that record. Automated tests do not measure LLM accuracy. Request timing from the smoke script is not voice time-to-first-audio or end-to-end logging latency. Label uploads, custom-food creation, signup/login and fitness/weight features are unimplemented. The deployed build is ready, but unrestricted reviewer access remains to be configured/verified.
