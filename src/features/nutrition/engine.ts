export class NutritionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Nutrients = { calories: number; protein: number; carbs: number; fat: number };
export type Portion = {
  id: string;
  label: string;
  grams: number;
  unit: "piece" | "serving" | "ml";
  amount: number;
};
export type Food = {
  id: string;
  name: string;
  per100g: Nutrients;
  portions: Portion[];
  source: {
    provider: "USDA FoodData Central";
    fdcId: number;
    dataType: string;
    url: string;
    fetchedAt: string;
  };
};
export type Quantity = {
  amount: number;
  unit: "g" | "ml" | "piece" | "serving";
  portionId?: string;
};
export function number(value: unknown, label: string, min = 0.01, max = 10000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new NutritionError(`${label} must be between ${min} and ${max}`);
  return value;
}
export function quantity(value: unknown): Quantity {
  if (!value || typeof value !== "object") throw new NutritionError("Specify an amount and unit");
  const q = value as Record<string, unknown>;
  number(q.amount, "Quantity");
  if (!["g", "ml", "piece", "serving"].includes(String(q.unit)))
    throw new NutritionError("Use g, ml, piece, or serving");
  return {
    amount: q.amount as number,
    unit: q.unit as Quantity["unit"],
    ...(typeof q.portionId === "string" ? { portionId: q.portionId } : {}),
  };
}
export function gramsFor(food: Food, q: Quantity) {
  quantity(q);
  if (q.unit === "g") return number(q.amount, "Grams");
  const options = food.portions.filter(
    (p) => p.unit === q.unit && (!q.portionId || p.id === q.portionId),
  );
  if (options.length !== 1)
    throw new NutritionError(
      options.length
        ? "Choose a serving size; more than one USDA portion matches"
        : `No verified ${q.unit} conversion. Please provide grams or select a USDA portion.`,
    );
  return number((q.amount / options[0].amount) * options[0].grams, "Converted grams");
}
export function calculate(food: Food, q: Quantity) {
  const grams = gramsFor(food, q);
  const nutrients = Object.fromEntries(
    Object.entries(food.per100g).map(([key, value]) => [key, (value * grams) / 100]),
  ) as Nutrients;
  return { grams, nutrients };
}
const zero = (): Nutrients => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
export function sum(items: Nutrients[]): Nutrients {
  return items.reduce((total, item) => {
    for (const key of Object.keys(total) as (keyof Nutrients)[]) total[key] += item[key];
    return total;
  }, zero());
}
export const rounded = (n: number) => Math.round(n * 10) / 10;
export function localDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    value < "2020-01-01" ||
    value > "2100-12-31"
  )
    throw new NutritionError("Use a real date in YYYY-MM-DD format");
  return value;
}
