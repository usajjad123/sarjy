export type Pace = "relaxed" | "balanced" | "full";
export type ActivityKind = "outdoors" | "indoors" | "food" | "travel";
export interface Activity { id: string; title: string; time: string; durationMinutes: number; kind: ActivityKind; notes: string; locked: boolean }
export interface TripDay { id: string; date: string; title: string; activities: Activity[] }
export interface Trip { id: string; title: string; destination: string; startDate: string; durationDays: number; interests: string[]; pace: Pace; days: TripDay[]; updatedAt: string }
export interface Memory { key: string; value: string; updatedAt: string }
export interface Workspace { version: number; activeTripId: string | null; trips: Trip[]; memories: Memory[]; appliedCalls: string[] }
export type TripAction = { name: string; args: Record<string, unknown> };
export class TripError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const emptyWorkspace = (): Workspace => ({ version: 0, activeTripId: null, trips: [], memories: [], appliedCalls: [] });
export const activeTrip = (workspace: Workspace) => workspace.trips.find((trip) => trip.id === workspace.activeTripId) || null;
export function conversationContext(workspace: Workspace) {
  return { version: workspace.version, activeTrip: activeTrip(workspace), trips: workspace.trips.map(({ id, title, destination, startDate, durationDays }) => ({ id, title, destination, startDate, durationDays })), memories: workspace.memories };
}
export const isoDate = (date: string, offset = 0) => new Date(new Date(`${date}T12:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
function text(value: unknown, label: string, max = 300): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TripError(`Provide ${label} (up to ${max} characters)`);
  return value.trim();
}
function integer(value: unknown, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new TripError(`${label} must be between ${min} and ${max}`);
  return value as number;
}
function date(value: unknown) {
  const result = text(value, "a start date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T12:00:00Z`)) || isoDate(result) !== result || result < "2020-01-01" || result > "2100-12-31") throw new TripError("Use a real calendar date in YYYY-MM-DD format");
  return result;
}
function activity(input: unknown, previous?: Activity): Activity {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TripError("Invalid activity");
  const fields = input as Record<string, unknown>;
  const time = fields.time === undefined ? previous?.time || "09:00" : text(fields.time, "a time", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new TripError("Activity time must use HH:MM");
  const kind = fields.kind ?? previous?.kind ?? "outdoors";
  if (!["outdoors", "indoors", "food", "travel"].includes(String(kind))) throw new TripError("Invalid activity type");
  const locked = fields.locked ?? previous?.locked ?? false;
  if (typeof locked !== "boolean") throw new TripError("Invalid lock value");
  const notes = fields.notes === undefined ? previous?.notes || "" : fields.notes;
  if (typeof notes !== "string" || notes.length > 1000) throw new TripError("Activity notes must be under 1000 characters");
  return { id: previous?.id || crypto.randomUUID(), title: text(fields.title ?? previous?.title, "an activity title", 200), time, durationMinutes: integer(fields.durationMinutes ?? previous?.durationMinutes ?? 60, "Duration in minutes", 15, 720), kind: kind as ActivityKind, notes, locked };
}

// Every UI edit and voice tool uses this reducer. The model never owns trip state.
export function applyTripAction(original: Workspace, action: TripAction): Workspace {
  const workspace = structuredClone(original);
  const args = action.args;
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new TripError("Invalid action arguments");
  const now = new Date().toISOString();
  if (action.name === "create_trip") {
    if (workspace.trips.length >= 20) throw new TripError("You can save up to 20 trips in this browser");
    const destination = text(args.destination, "a city and country", 120);
    const startDate = date(args.startDate);
    const durationDays = integer(args.durationDays, "Trip length", 1, 14);
    const interests = args.interests ?? [];
    if (!Array.isArray(interests) || interests.length > 12 || !interests.every((item) => typeof item === "string" && item.trim().length > 0 && item.length < 80)) throw new TripError("Invalid interests");
    const pace = args.pace ?? "balanced";
    if (!["relaxed", "balanced", "full"].includes(String(pace))) throw new TripError("Choose relaxed, balanced, or full pace");
    const trip: Trip = { id: crypto.randomUUID(), title: args.title ? text(args.title, "a trip title", 120) : `${destination.split(",")[0]} escape`, destination, startDate, durationDays, pace: pace as Pace, interests: interests.map((item: string) => item.trim()), updatedAt: now, days: Array.from({ length: durationDays }, (_, index) => ({ id: crypto.randomUUID(), date: isoDate(startDate, index), title: `A day to discover`, activities: [] })) };
    workspace.trips.unshift(trip); workspace.activeTripId = trip.id;
  } else if (action.name === "select_trip") {
    if (!workspace.trips.some((trip) => trip.id === args.tripId)) throw new TripError("Trip not found", 404);
    workspace.activeTripId = args.tripId as string;
  } else if (action.name === "remember_fact") {
    const key = text(args.key, "a memory name", 60).toLowerCase().replaceAll(" ", "_");
    const value = text(args.value, "a memory value", 300);
    if (!workspace.memories.some((memory) => memory.key === key) && workspace.memories.length >= 30) throw new TripError("You can remember up to 30 facts");
    workspace.memories = [...workspace.memories.filter((memory) => memory.key !== key), { key, value, updatedAt: now }];
  } else if (action.name === "forget_fact") {
    workspace.memories = workspace.memories.filter((memory) => memory.key !== text(args.key, "a memory name", 60).toLowerCase().replaceAll(" ", "_"));
  } else {
    const trip = activeTrip(workspace);
    if (!trip) throw new TripError("Create or select a trip first");
    if (action.name === "set_day_plan") {
      const day = trip.days[integer(args.day, "Day", 1, trip.durationDays) - 1];
      if (!Array.isArray(args.activities) || args.activities.length > 16) throw new TripError("Provide up to 16 activities per day");
      const seen = new Set<string>();
      const activities = args.activities.map((input: unknown) => {
        const fields = input as Record<string, unknown>;
        const previous = fields?.id ? day.activities.find((item) => item.id === fields.id) : undefined;
        if (fields?.id && !previous) throw new TripError("Activity ID does not belong to this day; use move_activity to move it");
        const next = activity(input, previous);
        if (seen.has(next.id)) throw new TripError("Duplicate activity ID");
        seen.add(next.id);
        if (previous?.locked && JSON.stringify(next) !== JSON.stringify(previous)) throw new TripError("A fixed activity cannot be changed. Unlock it first.");
        return next;
      });
      if (day.activities.some((item) => item.locked && !seen.has(item.id))) throw new TripError("Keep all fixed activities in the day plan");
      day.title = args.title ? text(args.title, "a day title", 150) : day.title;
      day.activities = activities;
    } else if (action.name === "add_activity") {
      const day = trip.days[integer(args.day, "Day", 1, trip.durationDays) - 1];
      if (day.activities.length >= 16) throw new TripError("A day can have up to 16 activities");
      day.activities.push(activity(args));
    } else if (["update_activity", "remove_activity", "move_activity"].includes(action.name)) {
      const from = trip.days.find((day) => day.activities.some((item) => item.id === args.activityId));
      const previous = from?.activities.find((item) => item.id === args.activityId);
      if (!from || !previous) throw new TripError("Activity not found. Read the current trip first.", 404);
      if (previous.locked && !(action.name === "update_activity" && args.locked === false && Object.keys(args).every((key) => ["activityId", "locked"].includes(key)))) throw new TripError("This activity is fixed. Unlock it before changing it.");
      if (action.name === "update_activity") from.activities = from.activities.map((item) => item.id === previous.id ? activity(args, previous) : item);
      else if (action.name === "remove_activity") from.activities = from.activities.filter((item) => item.id !== previous.id);
      else {
        const to = trip.days[integer(args.toDay, "Destination day", 1, trip.durationDays) - 1];
        if (to !== from && to.activities.length >= 16) throw new TripError("A day can have up to 16 activities");
        from.activities = from.activities.filter((item) => item.id !== previous.id); to.activities.push(previous);
      }
    } else if (action.name === "update_trip") {
      if (args.destination !== undefined) trip.destination = text(args.destination, "a city and country", 120);
      if (args.title !== undefined) trip.title = text(args.title, "a title", 120);
      if (args.startDate !== undefined) { trip.startDate = date(args.startDate); trip.days.forEach((day, index) => { day.date = isoDate(trip.startDate, index); }); }
      if (args.pace !== undefined) { if (!["relaxed", "balanced", "full"].includes(String(args.pace))) throw new TripError("Invalid pace"); trip.pace = args.pace as Pace; }
    } else throw new TripError("Unknown trip action");
    trip.updatedAt = now;
  }
  workspace.version++;
  return workspace;
}
