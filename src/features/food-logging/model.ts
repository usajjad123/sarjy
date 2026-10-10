import {
  calculate,
  localDate,
  number,
  NutritionError,
  quantity,
  sum,
  validDate,
  type Food,
  type Nutrients,
  type Quantity,
} from "../nutrition/engine";
export type Entry = {
  id: string;
  food: Food;
  quantity: Quantity;
  grams: number;
  nutrients: Nutrients;
};
export type Meal = { id: string; name: string; date: string; entries: Entry[]; createdAt: string };
type SavedMeal = { id: string; name: string; entries: Entry[] };
export type Candidate = { fdcId: number; name: string; dataType: string };
export type PendingItem = {
  id: string;
  query: string;
  quantity?: Quantity;
  candidates: Candidate[];
  food?: Food;
  issue?: string;
};
export type Pending = {
  id: string;
  mealName: string;
  date: string;
  mealId?: string;
  items: PendingItem[];
  createdAt: string;
};
type Data = {
  goals: Nutrients;
  goalsConfigured: boolean;
  timezone: string;
  meals: Meal[];
  savedMeals: SavedMeal[];
  foods: Food[];
  memories: { key: string; value: string }[];
  focusMealId: string | null;
  focusEntryId: string | null;
};
type Operation = { id: string; name: string; at: string; before: Data; undone: boolean };
export type Workspace = Data & {
  version: number;
  pending: Pending | null;
  operations: Operation[];
  appliedCalls: string[];
  committedBatches: string[];
};
export type Action = { name: string; args: Record<string, unknown> };
export function emptyWorkspace(): Workspace {
  return {
    version: 0,
    goals: { calories: 2000, protein: 120, carbs: 250, fat: 65 },
    goalsConfigured: false,
    timezone: "Asia/Riyadh",
    meals: [],
    savedMeals: [],
    foods: [],
    memories: [],
    focusMealId: null,
    focusEntryId: null,
    pending: null,
    operations: [],
    appliedCalls: [],
    committedBatches: [],
  };
}
export function text(value: unknown, label: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new NutritionError(`${label} is required (up to ${max} characters)`);
  return value.trim();
}
export function context(w: Workspace, date = localDate(w.timezone)) {
  validDate(date);
  const meals = w.meals.filter((m) => m.date === date);
  const totals = sum(meals.flatMap((m) => m.entries.map((e) => e.nutrients)));
  return {
    version: w.version,
    today: localDate(w.timezone),
    date,
    timezone: w.timezone,
    goals: w.goals,
    goalsConfigured: w.goalsConfigured,
    totals,
    remaining: Object.fromEntries(
      Object.entries(w.goals).map(([k, v]) => [k, v - totals[k as keyof Nutrients]]),
    ),
    meals,
    focusMealId: w.focusMealId,
    focusEntryId: w.focusEntryId,
    recentMeals: w.meals.slice(-12),
    savedMeals: w.savedMeals,
    foods: w.foods,
    memories: w.memories,
    pending: w.pending,
    undoableOperation: [...w.operations].reverse().find((o) => !o.undone)?.id ?? null,
  };
}
function data(w: Workspace): Data {
  const {
    goals,
    goalsConfigured,
    timezone,
    meals,
    savedMeals,
    foods,
    memories,
    focusMealId,
    focusEntryId,
  } = w;
  return structuredClone({
    goals,
    goalsConfigured,
    timezone,
    meals,
    savedMeals,
    foods,
    memories,
    focusMealId,
    focusEntryId,
  });
}
function entry(food: Food, q: Quantity): Entry {
  return {
    id: crypto.randomUUID(),
    food: structuredClone(food),
    quantity: q,
    ...calculate(food, q),
  };
}
function findMeal(w: Workspace, id: unknown) {
  const meal = w.meals.find((m) => m.id === id);
  if (!meal) throw new NutritionError("Meal not found. Read current records before editing.", 404);
  return meal;
}
function findEntry(w: Workspace, id: unknown) {
  for (const m of w.meals) {
    const e = m.entries.find((e) => e.id === id);
    if (e) return { meal: m, entry: e };
  }
  throw new NutritionError("Food entry not found. Clarify which food to change.", 404);
}
function validatePendingItem(item: PendingItem) {
  try {
    if (!item.food) throw new NutritionError("Choose a matching food first");
    if (!item.quantity) throw new NutritionError("How much did you eat?");
    calculate(item.food, item.quantity);
    item.issue = undefined;
  } catch (error) {
    item.issue = (error as Error).message;
  }
}
export function applyAction(original: Workspace, action: Action): Workspace {
  const w = structuredClone(original),
    a = action.args;
  const before = data(w);
  let tracked = true;
  switch (action.name) {
    case "start_food_log": {
      if (w.pending)
        throw new NutritionError("Finish or cancel the existing food draft first", 409);
      if (!Array.isArray(a.items) || !a.items.length || a.items.length > 12)
        throw new NutritionError("Log between 1 and 12 foods at once");
      const existingMeal = a.mealId ? findMeal(w, a.mealId) : null;
      if (existingMeal && a.date && existingMeal.date !== a.date)
        throw new NutritionError("Use the existing meal’s date when adding food");
      w.pending = {
        id: crypto.randomUUID(),
        mealName: text(a.mealName ?? existingMeal?.name ?? "Meal", "Meal name"),
        date: validDate(a.date ?? existingMeal?.date ?? localDate(w.timezone)),
        ...(existingMeal ? { mealId: existingMeal.id } : {}),
        createdAt: new Date().toISOString(),
        items: a.items.map((item) => {
          if (!item || typeof item !== "object") throw new NutritionError("Invalid food");
          return {
            id: crypto.randomUUID(),
            query: text(item.query, "Food description"),
            ...(item.quantity ? { quantity: quantity(item.quantity) } : {}),
            candidates: [],
          };
        }),
      };
      tracked = false;
      break;
    }
    case "set_candidates": {
      const item = w.pending?.items.find((i) => i.id === a.itemId);
      if (!item) throw new NutritionError("Draft item no longer exists", 409);
      if (a.query !== undefined) item.query = text(a.query, "Food description");
      delete item.food;
      item.candidates = a.candidates as Candidate[];
      item.issue = item.candidates.length
        ? "Choose the matching food and preparation"
        : "No USDA matches. Try a more specific description.";
      tracked = false;
      break;
    }
    case "resolve_food": {
      const item = w.pending?.items.find((i) => i.id === a.itemId);
      if (!item) throw new NutritionError("Draft item no longer exists", 409);
      const food = a.food as Food;
      if (!food || !item.candidates.some((c) => c.fdcId === food.source.fdcId))
        throw new NutritionError("Choose a food returned for this draft");
      item.food = structuredClone(food);
      if (a.quantity) item.quantity = quantity(a.quantity);
      validatePendingItem(item);
      tracked = false;
      break;
    }
    case "set_pending_quantity": {
      const item = w.pending?.items.find((i) => i.id === a.itemId);
      if (!item) throw new NutritionError("Draft item no longer exists", 409);
      item.quantity = quantity(a.quantity);
      validatePendingItem(item);
      tracked = false;
      break;
    }
    case "commit_food_log": {
      if (w.committedBatches.includes(String(a.batchId))) return w;
      const p = w.pending;
      if (!p || p.id !== a.batchId)
        throw new NutritionError("Draft changed. Read current context.", 409);
      const entries = p.items.map((i) => {
        if (!i.food || !i.quantity || i.issue)
          throw new NutritionError("Resolve every food and quantity before saving");
        return entry(i.food, i.quantity);
      });
      const meal = p.mealId
        ? findMeal(w, p.mealId)
        : {
            id: crypto.randomUUID(),
            name: p.mealName,
            date: p.date,
            entries: [],
            createdAt: new Date().toISOString(),
          };
      if (!p.mealId) w.meals.push(meal);
      meal.entries.push(...entries);
      for (const e of entries) if (!w.foods.some((f) => f.id === e.food.id)) w.foods.push(e.food);
      w.focusMealId = meal.id;
      w.focusEntryId = entries.length === 1 ? entries[0].id : null;
      w.committedBatches = [...w.committedBatches.slice(-199), p.id];
      w.pending = null;
      break;
    }
    case "cancel_pending":
      w.pending = null;
      tracked = false;
      break;
    case "update_quantity": {
      const { meal, entry: e } = findEntry(w, a.entryId);
      const q = quantity(a.quantity);
      Object.assign(e, { quantity: q, ...calculate(e.food, q) });
      w.focusMealId = meal.id;
      w.focusEntryId = e.id;
      break;
    }
    case "remove_entry": {
      const { meal, entry: e } = findEntry(w, a.entryId);
      meal.entries = meal.entries.filter((v) => v.id !== e.id);
      w.focusMealId = meal.id;
      w.focusEntryId = null;
      break;
    }
    case "undo": {
      const last = [...w.operations].reverse().find((o) => !o.undone);
      if (!last) throw new NutritionError("There is nothing to undo");
      if (a.operationId && a.operationId !== last.id)
        throw new NutritionError("Only the latest operation can be undone", 409);
      // Timezone is an untracked diary setting, not part of the operation being undone.
      const timezone = w.timezone;
      Object.assign(w, structuredClone(last.before), { timezone });
      last.undone = true;
      w.pending = null;
      tracked = false;
      break;
    }
    case "save_meal": {
      const meal = findMeal(w, a.mealId);
      if (!meal.entries.length) throw new NutritionError("An empty meal cannot be saved");
      const name = text(a.name, "Saved meal name");
      const existing = w.savedMeals.find((m) => m.name.toLowerCase() === name.toLowerCase());
      if (existing && a.replace !== true)
        throw new NutritionError("A saved meal has this name. Ask before replacing it", 409);
      const saved = {
        id: existing?.id ?? crypto.randomUUID(),
        name,
        entries: structuredClone(meal.entries),
      };
      if (existing) Object.assign(existing, saved);
      else w.savedMeals.push(saved);
      break;
    }
    case "log_saved_meal":
    case "copy_meal": {
      const source =
        action.name === "copy_meal"
          ? findMeal(w, a.mealId)
          : w.savedMeals.find((m) => m.id === a.savedMealId);
      if (!source || !source.entries.length)
        throw new NutritionError("Saved meal not found or empty", 404);
      const meal: Meal = {
        id: crypto.randomUUID(),
        name: text(a.mealName ?? source.name, "Meal name"),
        date: validDate(a.date ?? localDate(w.timezone)),
        createdAt: new Date().toISOString(),
        entries: source.entries.map((e) => ({ ...structuredClone(e), id: crypto.randomUUID() })),
      };
      w.meals.push(meal);
      w.focusMealId = meal.id;
      w.focusEntryId = meal.entries.length === 1 ? meal.entries[0].id : null;
      break;
    }
    case "forget_saved_meal": {
      if (!w.savedMeals.some((m) => m.id === a.savedMealId))
        throw new NutritionError("Saved meal not found", 404);
      w.savedMeals = w.savedMeals.filter((m) => m.id !== a.savedMealId);
      break;
    }
    case "forget_food": {
      if (!w.foods.some((f) => f.id === a.foodId))
        throw new NutritionError("Saved food not found", 404);
      w.foods = w.foods.filter((f) => f.id !== a.foodId);
      break;
    }
    case "use_saved_food": {
      const item = w.pending?.items.find((i) => i.id === a.itemId),
        food = w.foods.find((f) => f.id === a.foodId);
      if (!item || !food) throw new NutritionError("Draft item or saved food not found", 404);
      item.food = structuredClone(food);
      if (a.quantity) item.quantity = quantity(a.quantity);
      validatePendingItem(item);
      tracked = false;
      break;
    }
    case "set_goals": {
      let changed = false;
      for (const key of Object.keys(w.goals) as (keyof Nutrients)[])
        if (a[key] !== undefined) {
          w.goals[key] = number(a[key], key, 1, key === "calories" ? 10000 : 1000);
          changed = true;
        }
      if (!changed) throw new NutritionError("Specify a target");
      w.goalsConfigured = true;
      break;
    }
    case "set_timezone": {
      const timezone = text(a.timezone, "Timezone", 80);
      try {
        localDate(timezone);
      } catch {
        throw new NutritionError("Invalid IANA timezone");
      }
      w.timezone = timezone;
      tracked = false;
      break;
    }
    case "remember_fact": {
      const key = text(a.key, "Memory key", 60).toLowerCase().replaceAll(" ", "_");
      const value = text(a.value, "Memory", 500);
      const old = w.memories.find((m) => m.key === key);
      if (old) old.value = value;
      else {
        if (w.memories.length >= 50) throw new NutritionError("Memory library is full");
        w.memories.push({ key, value });
      }
      break;
    }
    case "forget_fact": {
      const key = text(a.key, "Memory key", 60).toLowerCase().replaceAll(" ", "_");
      if (!w.memories.some((m) => m.key === key)) throw new NutritionError("Memory not found", 404);
      w.memories = w.memories.filter((m) => m.key !== key);
      break;
    }
    default:
      throw new NutritionError("Unknown nutrition command");
  }
  if (w.meals.length > 2000 || w.savedMeals.length > 100 || w.foods.length > 300)
    throw new NutritionError("Your library is full; export your records before adding more");
  if (tracked)
    w.operations = [
      ...w.operations.slice(-19),
      {
        id: crypto.randomUUID(),
        name: action.name,
        at: new Date().toISOString(),
        before,
        undone: false,
      },
    ];
  w.version++;
  return w;
}
