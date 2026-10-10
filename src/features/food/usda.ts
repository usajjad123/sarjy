import { NutritionError, type Food, type Nutrients, type Portion } from "../nutrition/engine";
import type { Candidate } from "../food-logging/model";
type USDA = {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: { amount: number; nutrient: { id: number; unitName: string } }[];
  foodPortions?: {
    id: number;
    gramWeight: number;
    amount: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: { name: string };
  }[];
};
export function normalizeFood(raw: USDA): Food {
  const nutrients = raw.foodNutrients ?? [];
  const get = (ids: number[], unit: string) => {
    for (const id of ids) {
      const n = nutrients.find(
        (n) =>
          n.nutrient?.id === id &&
          typeof n.nutrient.unitName === "string" &&
          n.nutrient.unitName.toLowerCase() === unit &&
          Number.isFinite(n.amount) &&
          n.amount >= 0,
      );
      if (n) return n.amount;
    }
    throw new NutritionError(
      "This USDA record is missing a required nutrient. Choose another match.",
      422,
    );
  };
  const per100g: Nutrients = {
    calories: get([1008, 2048, 2047], "kcal"),
    protein: get([1003], "g"),
    carbs: get([1005], "g"),
    fat: get([1004], "g"),
  };
  const portions: Portion[] = [];
  for (const p of raw.foodPortions ?? []) {
    if (
      !Number.isFinite(p.gramWeight) ||
      !Number.isFinite(p.amount) ||
      !(p.gramWeight > 0) ||
      !(p.amount > 0)
    )
      continue;
    const label = p.modifier || p.portionDescription || p.measureUnit?.name || "USDA serving";
    portions.push({
      id: `${p.id}:serving`,
      label: `${p.amount} ${label} (${p.gramWeight} g)`,
      grams: p.gramWeight,
      amount: 1,
      unit: "serving",
    });
    if (
      /\b(small|medium|large|extra large|jumbo|egg|fruit|piece|slice|breast)\b/i.test(label) &&
      !/\b(cup|tbsp|tsp|oz|chopped|diced)\b/i.test(label)
    )
      portions.push({
        id: `${p.id}:piece`,
        label: `${label} (${p.gramWeight / p.amount} g each)`,
        grams: p.gramWeight,
        amount: p.amount,
        unit: "piece",
      });
    const volume = /tablespoon|\btbsp\b/i.test(label)
      ? 14.7868
      : /teaspoon|\btsp\b/i.test(label)
        ? 4.92892
        : /\bcup\b/i.test(label)
          ? 236.588
          : /\bml\b|milliliter/i.test(label)
            ? 1
            : 0;
    if (volume && !/heaped|heaping/i.test(label))
      portions.push({
        id: `${p.id}:ml`,
        label: `ml from USDA ${label} (${p.gramWeight} g / ${p.amount * volume} ml)`,
        grams: p.gramWeight,
        amount: p.amount * volume,
        unit: "ml",
      });
  }
  return {
    id: `usda:${raw.fdcId}`,
    name: raw.description,
    per100g,
    portions,
    source: {
      provider: "USDA FoodData Central",
      fdcId: raw.fdcId,
      dataType: raw.dataType,
      url: `https://fdc.nal.usda.gov/food-details/${raw.fdcId}/nutrients`,
      fetchedAt: new Date().toISOString(),
    },
  };
}
const cache = new Map<string, { expires: number; data: unknown }>();
async function request(path: string, body?: unknown) {
  const key = process.env.USDA_API_KEY || (process.env.NODE_ENV !== "production" ? "DEMO_KEY" : "");
  if (!key)
    throw new NutritionError(
      "Food lookup is not configured. Add USDA_API_KEY; your saved foods still work.",
      503,
    );
  const cacheKey = `${path}:${JSON.stringify(body ?? null)}`,
    hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/${path}?api_key=${encodeURIComponent(key)}`,
      {
        method: body ? "POST" : "GET",
        ...(body
          ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
          : {}),
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      },
    );
    if (!res.ok)
      throw new NutritionError(
        res.status === 429
          ? "USDA's lookup limit was reached. Try later or use a saved food."
          : "USDA lookup is unavailable. No food has been logged.",
        res.status === 429 ? 429 : 502,
      );
    const data = await res.json();
    if (cache.size > 300) cache.clear();
    cache.set(cacheKey, { expires: Date.now() + 86400000, data });
    return data;
  } catch (error) {
    if (error instanceof NutritionError) throw error;
    throw new NutritionError(
      "USDA could not be reached. Your draft is saved; try lookup again.",
      502,
    );
  }
}
export async function searchFoods(query: string): Promise<Candidate[]> {
  const result = (await request("foods/search", {
    query,
    dataType: ["SR Legacy", "Foundation"],
    pageSize: 8,
  })) as { foods?: { fdcId: number; description: string; dataType: string }[] };
  return (result.foods ?? [])
    .filter((f) => Number.isInteger(f.fdcId) && f.description)
    .map((f) => ({ fdcId: f.fdcId, name: f.description, dataType: f.dataType }));
}
export async function getFood(fdcId: number) {
  if (!Number.isInteger(fdcId) || fdcId <= 0) throw new NutritionError("Invalid USDA food ID");
  return normalizeFood((await request(`food/${fdcId}`)) as USDA);
}
