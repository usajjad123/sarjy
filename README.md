# Sarjy… your trip partner

A voice-first itinerary planner. Build and revise a day-by-day trip with Sarjy, keep fixed stops protected, remember preferences across sessions without signing up, and explore how your saved itinerary might feel in the destination's actual weather.

## Start locally

```sh
npm install
cp env.example .env.local
# Set GEMINI_API_KEY in .env.local
npm run dev -- --port 3001
```

Open http://localhost:3001. Create a trip, then click **Build with Sarjy** to generate and save its days. **Let’s talk** enables microphone conversation; typed messages use the same live model and tools without requesting microphone access.

Each browser gets an opaque, HTTP-only guest cookie. The server stores trips and memories in `.data/sarjy.db` locally. Reloading or starting a new voice session retains them. A different browser starts fresh; clearing cookies loses the browser's access to its records. The database is git-ignored.

## The itinerary owns the state

UI edits and Gemini tools use `applyTripAction` in `src/lib/trips/model.ts`. The model requests structured actions; the server validates them and persists the result before Sarjy can report success. Existing stop IDs survive edits and moves. Fixed activities cannot be moved, changed, removed, or omitted from a regenerated day until explicitly unlocked in the UI.

Workspace versions provide optimistic concurrency: stale requests return 409. Guest identity scopes database access. Trip identity prevents a queued voice edit from changing a newly selected trip. Tool call IDs are deduplicated. UI edits update the live conversation context without interrupting playback; Sarjy must read current saved state before editing. Only the active itinerary, trip summaries, and memories are sent as conversational context, not every saved itinerary.

Tools cover current context, trip creation and selection, day plans, adding/editing/moving/removing stops, changing title/destination/date/pace, and remembering/forgetting explicit facts. Memory writes visibly acknowledge what was saved. **My travel style** lets you inspect, correct (by saving the same preference name), and remove memories.

## Weather and experience

Open-Meteo geocoding resolves a city and country; its forecast API supplies daily temperatures, weather codes, rain probability, and wind. Requests use the destination timezone and only dates inside the supported forecast window. Unknown locations, ambiguous cities, distant dates, and API failures produce explicit unavailable states. Weather never fabricates venue information or automatically rearranges your saved itinerary.

The **How your trip might feel** card is a cautious, deterministic reflection of the current saved plan, pace, interests, and real forecast. Gemini receives this same grounded context and gives a natural spoken reflection after planning or editing. Mood is presented as a possibility, not a guarantee. Forecast values are rendered from API data, with attribution and retrieval time.

API choice: Weather materially changes the experience of an itinerary: rain, heat, and cold affect whether outdoor stops feel comfortable or call for flexibility. Open-Meteo makes the integration part of the planning experience rather than a decorative API call, allowing Sarjy to explain cozy alternatives or sun-soaked days using real forecast data. [Forecast docs](https://open-meteo.com/en/docs), [geocoding docs](https://open-meteo.com/en/docs/geocoding-api).

## Voice and UI deep dive

Gemini Live connects from the browser with a one-use constrained ephemeral token. PCM16 microphone audio streams through an AudioWorklet; output PCM24kHz audio is scheduled for playback. Transcription, audio levels, and actual speech activity are separate events. Sarjy's avatar remains active across streamed chunks and silent samples; user animation uses visual speech hysteresis and a 450 ms release hold. Metering does not filter or gate microphone input. Explicit interruption clears playback.

Libraries.dev bot avatars and Motion provide the animated companion and smooth volume-driven feedback, respecting reduced motion. The itinerary is the main workspace, with editable cards, daily navigation, saved trips, a compact voice sidebar, and a mobile companion shortcut. Dialogs support Escape and keyboard focus containment.

## Validation

```sh
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
# Start the app first; uses isolated test guests and a real weather request:
node scripts/smoke-api.mjs
npm run build -- --webpack
```

Verified locally: anonymous guest isolation, save/reload, fixed stops, stale-edit rejection, real Kyoto forecasts, Gemini creating all three days of a 14-stop itinerary, a conversational activity move retaining its ID/time, remembering favorite color, recalling it in a fresh session after reload, and direct card editing. Regression tests cover animation stability, trip state invariants, and weather failures. The environment restricts Turbopack production build workers; Webpack production builds pass.

## Public deployment

The app is prepared for a Next.js deployment with a hosted libSQL/Turso database. Configure `GEMINI_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` on the host. Schema tables initialize automatically. Local file storage must not be used on an ephemeral serverless filesystem; the app refuses that fallback on Vercel. Confirm the appropriate [Open-Meteo usage tier](https://open-meteo.com/en/pricing) for the deployment.

A public URL has not yet been provisioned. This workspace currently has the Gemini key but no connected hosting project or hosted database. The local app does not book or pay, verify venue opening hours, provide routes, support multi-city trips within one itinerary, or sync identity across browsers. It currently supports up to 14 days per trip and 20 saved trips per browser. Export downloads the selected itinerary as JSON.
