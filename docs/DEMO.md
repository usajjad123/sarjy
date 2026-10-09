# Sarjy demo walkthrough

1. Open the app with no login. Create a Kyoto, Japan trip for three upcoming days, with food, temples, and quiet streets at a relaxed pace.
2. Click **Build with Sarjy**. Watch structured tools populate each itinerary day and persist every stop. Sarjy explains the likely experience using the actual forecast.
3. Keep one stop fixed in the UI. Ask Sarjy to move another stop to day two. The fixed stop stays protected, while the requested stop moves with its ID and details intact.
4. Edit a stop's notes directly. Ask what is planned; Sarjy reads the saved itinerary rather than treating old conversation as state.
5. Say "Remember that my favorite color is sage green." Check My travel style.
6. Reload, start a fresh conversation, and ask "What's my favorite color?" The itinerary and preference remain.
7. Show the weather attribution and updated experience card. Explain the unavailable state for dates beyond the forecast window and the difference between data-backed weather and suggested activities.

Code walkthrough: `model.ts` is the shared action reducer; `store.ts` scopes persistent state to an anonymous cookie and applies version checks; `trip-action/route.ts` is the tool/UI boundary; `weather.ts` calls Open-Meteo and derives the experience; `GeminiLiveProvider.ts` connects voice tools and playback; `use-sarjy.ts` and `page.tsx` keep the visual itinerary and conversation together.

Before presentation: provision the public host and hosted database, verify voice permissions in the target browser, and capture a short screen recording. Headphones help reduce echo. The current local instance is on port 3001.
