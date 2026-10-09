import type { Trip } from "./model";
import { isoDate } from "./model";
export interface WeatherDay { date: string; condition: string; high: number; low: number; rainChance: number | null; wind: number | null }
export interface WeatherReport { status: "ready" | "partial" | "out_of_range" | "unavailable" | "ambiguous"; location: string; timezone?: string; checkedAt: string; message: string; days: WeatherDay[]; source: string }
export interface TripExperience { title: string; body: string; basis: string }
const SOURCE = "https://open-meteo.com/";
const cache = new Map<string, { expires: number; promise: Promise<WeatherReport> }>();
function condition(code: number): string | undefined {
  const descriptions: Record<number, string> = { 0: "Clear skies", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Heavy rain showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorms", 96: "Thunderstorms with hail", 99: "Thunderstorms with hail" };
  return descriptions[code];
}
function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}
async function request(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!response.ok) throw new Error("Weather service unavailable");
  return response.json();
}
async function fetchWeather(trip: Trip): Promise<WeatherReport> {
  const base: WeatherReport = { status: "unavailable", location: trip.destination, checkedAt: new Date().toISOString(), message: "Weather is temporarily unavailable. Your itinerary is still saved.", days: [], source: SOURCE };
  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.search = new URLSearchParams({ name: trip.destination, count: "3", language: "en", format: "json" }).toString();
    const geo = await request(geoUrl);
    const place = geo.results?.[0];
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return { ...base, message: "We couldn’t locate this destination. Use a city and country, such as Kyoto, Japan." };
    if (!trip.destination.includes(",") && geo.results?.length > 1 && geo.results[1].country_code !== place.country_code) return { ...base, status: "ambiguous", message: `Please specify a country for ${trip.destination}. Matches include ${geo.results.slice(0, 3).map((item: { name: string; country: string }) => `${item.name}, ${item.country}`).join(" or ")}.` };
    const timezone = place.timezone || "UTC";
    const today = dateInTimezone(timezone);
    const horizon = isoDate(today, 15);
    const endDate = trip.days.at(-1)!.date;
    const start = trip.startDate > today ? trip.startDate : today;
    const end = endDate < horizon ? endDate : horizon;
    const located = { ...base, timezone, location: `${place.name}, ${place.country}` };
    if (start > end) return { ...located, status: "out_of_range", message: endDate < today ? "These dates are in the past; a live forecast is not available." : "Forecast not available yet. Check back within 16 days of your trip." };
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), timezone, start_date: start, end_date: end, daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" }).toString();
    const forecast = await request(url);
    const daily = forecast.daily;
    if (!Array.isArray(daily?.time)) throw new Error("Missing forecast");
    const days: WeatherDay[] = daily.time.flatMap((day: string, index: number) => {
      const high = daily.temperature_2m_max?.[index], low = daily.temperature_2m_min?.[index], code = daily.weather_code?.[index];
      if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(code)) return [];
      const description = condition(code);
      if (!description) return [];
      const rain = daily.precipitation_probability_max?.[index], wind = daily.wind_speed_10m_max?.[index];
      return [{ date: day, condition: description, high, low, rainChance: Number.isFinite(rain) ? rain : null, wind: Number.isFinite(wind) ? wind : null }];
    });
    if (!days.length) throw new Error("Empty forecast");
    return { ...located, status: days.length === trip.days.length ? "ready" : "partial", message: days.length === trip.days.length ? "Forecast for your travel dates" : "Forecast available for part of your trip. Later days will appear closer to departure.", days };
  } catch { return base; }
}
export function getWeather(trip: Trip, refresh = false) {
  const key = `${trip.destination}:${trip.startDate}:${trip.durationDays}`;
  const hit = cache.get(key);
  if (!refresh && hit && hit.expires > Date.now()) return hit.promise;
  if (cache.size > 100) cache.clear();
  const promise = fetchWeather(trip);
  cache.set(key, { expires: Date.now() + 5 * 60000, promise });
  return promise;
}
export function tripExperience(trip: Trip, weather: WeatherReport): TripExperience {
  const count = trip.days.reduce((total, day) => total + day.activities.length, 0);
  const rhythm = trip.pace === "relaxed" ? "An unhurried rhythm" : trip.pace === "full" ? "A lively, discovery-filled rhythm" : "A balance of discovery and breathing room";
  const interests = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(trip.interests);
  const basis = `${count} planned stops · ${weather.days.length}/${trip.durationDays} days with forecasts · ${trip.pace} pace`;
  if (!weather.days.length) return { title: rhythm, body: `${count ? "Your saved itinerary leaves" : "Your trip has"} room for ${interests || "new discoveries"}. Weather hasn’t been confirmed for these dates, so we’ll keep the outdoor moments flexible.`, basis };
  const rain = weather.days.some((day) => (day.rainChance ?? 0) >= 60 || /rain|thunder|snow|drizzle/i.test(day.condition));
  const hot = weather.days.some((day) => day.high >= 32);
  const cold = weather.days.some((day) => day.high < 12);
  const title = hot ? "Sun-soaked days, slower afternoons" : rain ? "Cozy pauses between discoveries" : cold ? "Crisp air, warm little moments" : "Room to wander, room to breathe";
  const feeling = hot ? "The forecast suggests warm, energetic days. Shaded breaks and gentler afternoons could make the outdoor stops feel more comfortable." : rain ? "The forecast suggests some wet-weather moments. A little flexibility around outdoor stops could turn the trip into a mix of discovery and cozy indoor pauses." : cold ? "The forecast suggests cool days. Warm breaks between outdoor stops could give the trip a cozy, deliberate feel." : "The forecast looks inviting for exploring. Your saved plan could feel like a comfortable mix of discovery and time to take things in.";
  return { title, body: `${feeling} ${rhythm} leaves space for ${interests || "the things you love"}.`, basis };
}
