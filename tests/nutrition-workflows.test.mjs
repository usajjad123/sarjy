import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const moduleURL = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [key, value] of Object.entries(imports))
    outputText = outputText.replaceAll(`from "${key}"`, `from "${value}"`);
  return moduleURL(outputText);
}
const engineURL = compile("../src/features/nutrition/engine.ts");
const { calculate, gramsFor, localDate, quantity, sum } = await import(engineURL);
const modelURL = compile("../src/features/food-logging/model.ts", {
  "../nutrition/engine": engineURL,
});
const { emptyWorkspace, applyAction, context } = await import(modelURL);
const { normalizeFood, searchFoods } = await import(
  compile("../src/features/food/usda.ts", { "../nutrition/engine": engineURL })
);
// Deliberate test fixtures; never used as a production food fallback.
const chicken = {
  id: "usda:1",
  name: "Chicken breast, cooked",
  per100g: { calories: 165, protein: 31.02, carbs: 0, fat: 3.57 },
  portions: [],
  source: {
    provider: "USDA FoodData Central",
    fdcId: 1,
    dataType: "SR Legacy",
    url: "https://fdc.nal.usda.gov/",
    fetchedAt: "2026-10-09",
  },
};
const egg = {
  ...chicken,
  id: "usda:2",
  name: "Egg, hard boiled",
  per100g: { calories: 155, protein: 12.58, carbs: 1.12, fat: 10.61 },
  source: { ...chicken.source, fdcId: 2 },
  portions: [
    { id: "large", label: "Large egg", grams: 50, amount: 1, unit: "piece" },
    { id: "medium", label: "Medium egg", grams: 44, amount: 1, unit: "piece" },
  ],
};
const banana = {
  ...chicken,
  id: "usda:3",
  name: "Banana",
  per100g: { calories: 89, protein: 1.09, carbs: 22.84, fat: 0.33 },
  source: { ...chicken.source, fdcId: 3 },
};
const g = (amount) => ({ amount, unit: "g" });
const run = (w, name, args = {}) => applyAction(w, { name, args });
function draft(foods = [chicken], quantities = [g(200)], date = "2026-10-09") {
  let w = run(emptyWorkspace(), "start_food_log", {
    date,
    mealName: "Lunch",
    items: foods.map((f, i) => ({
      query: f.name,
      ...(quantities[i] ? { quantity: quantities[i] } : {}),
    })),
  });
  const ids = w.pending.items.map((i) => i.id);
  foods.forEach((f, i) => {
    w = run(w, "set_candidates", {
      itemId: ids[i],
      candidates: [{ fdcId: f.source.fdcId, name: f.name, dataType: "SR Legacy" }],
    });
    w = run(w, "resolve_food", { itemId: ids[i], food: f });
  });
  return w;
}
function logged(foods, quantities, date) {
  const w = draft(foods, quantities, date);
  return run(w, "commit_food_log", { batchId: w.pending.id });
}
const first = (w) => w.meals[0].entries[0];
test("01: multi-food utterance commits one meal atomically", () => {
  const w = logged([chicken, banana], [g(200), g(100)]);
  assert.equal(w.meals.length, 1);
  assert.equal(w.meals[0].entries.length, 2);
  assert.equal(context(w, "2026-10-09").totals.calories, 419);
});
test("02: three large eggs use verified piece conversion", () => {
  const w = logged([egg], [{ amount: 3, unit: "piece", portionId: "large" }]);
  assert.equal(first(w).grams, 150);
  assert.equal(first(w).nutrients.calories, 232.5);
});
test("03: actually two updates the existing egg ID", () => {
  let w = logged([egg], [{ amount: 3, unit: "piece", portionId: "large" }]);
  const id = first(w).id;
  w = run(w, "update_quantity", {
    entryId: id,
    quantity: { amount: 2, unit: "piece", portionId: "large" },
  });
  assert.equal(first(w).id, id);
  assert.equal(first(w).grams, 100);
  assert.equal(w.meals.length, 1);
  assert.equal(w.focusEntryId, id);
});
test("04: changing chicken to 180g recalculates on server", () => {
  let w = logged();
  w = run(w, "update_quantity", { entryId: first(w).id, quantity: g(180) });
  assert.equal(first(w).nutrients.calories, 297);
  assert.ok(Math.abs(first(w).nutrients.protein - 55.836) < 1e-9);
});
test("05: undo correction restores exact quantity", () => {
  let w = logged();
  const id = first(w).id;
  w = run(w, "update_quantity", { entryId: id, quantity: g(180) });
  w = run(w, "undo", { operationId: context(w).undoableOperation });
  assert.equal(first(w).grams, 200);
  assert.equal(first(w).id, id);
});
test("06: add banana uses relevant existing meal", () => {
  let w = logged();
  const id = w.meals[0].id;
  w = run(w, "start_food_log", {
    mealName: "Lunch",
    date: "2026-10-09",
    mealId: id,
    items: [{ query: "Banana", quantity: g(100) }],
  });
  const item = w.pending.items[0].id;
  w = run(w, "set_candidates", { itemId: item, candidates: [{ fdcId: 3 }] });
  w = run(w, "resolve_food", { itemId: item, food: banana });
  w = run(w, "commit_food_log", { batchId: w.pending.id });
  assert.equal(w.meals.length, 1);
  assert.equal(w.meals[0].entries.length, 2);
});
test("07: remove named entry leaves other foods intact", () => {
  let w = logged([chicken, banana], [g(200), g(100)]);
  w = run(w, "remove_entry", { entryId: w.meals[0].entries[1].id });
  assert.equal(w.meals[0].entries.length, 1);
  assert.equal(first(w).food.id, chicken.id);
});
test("08: undo removal restores exact IDs and nutrients", () => {
  let w = logged([chicken, banana], [g(200), g(100)]);
  const original = structuredClone(w.meals);
  w = run(w, "remove_entry", { entryId: w.meals[0].entries[1].id });
  w = run(w, "undo", {});
  assert.deepEqual(w.meals, original);
});
test("09: usual lunch persists through serialization", () => {
  let w = logged();
  w = run(w, "save_meal", { mealId: w.meals[0].id, name: "Usual lunch" });
  w = JSON.parse(JSON.stringify(w));
  w = run(w, "log_saved_meal", { savedMealId: w.savedMeals[0].id, date: "2026-10-10" });
  assert.equal(w.meals[1].entries[0].grams, 200);
  assert.notEqual(first(w).id, w.meals[1].entries[0].id);
});
test("10: same breakfast yesterday copies historical snapshot", () => {
  let w = logged([egg], [{ amount: 2, unit: "piece", portionId: "large" }], "2026-10-08");
  w = run(w, "copy_meal", { mealId: w.meals[0].id, date: "2026-10-09", mealName: "Breakfast" });
  assert.equal(context(w, "2026-10-09").totals.calories, 155);
});
test("11: last night is associated with supplied local date", () => {
  const w = logged(undefined, undefined, "2026-10-08");
  assert.equal(context(w, "2026-10-09").totals.calories, 0);
  assert.equal(context(w, "2026-10-08").totals.calories, 330);
});
test("12: repeated commit batch does not duplicate intake", () => {
  const d = draft();
  const id = d.pending.id;
  let w = run(d, "commit_food_log", { batchId: id });
  w = run(w, "commit_food_log", { batchId: id });
  assert.equal(w.meals.length, 1);
  assert.equal(w.meals[0].entries.length, 1);
});
test("13: pending quantities survive refresh and unrelated queries", () => {
  let w = draft([chicken], [undefined]);
  w = JSON.parse(JSON.stringify(w));
  const before = JSON.stringify(w);
  context(w, "2026-10-08");
  assert.equal(JSON.stringify(w), before);
  assert.equal(w.pending.items[0].issue, "How much did you eat?");
});
test("14: missing quantity prevents writes of any batch item", () => {
  const w = draft([chicken, banana], [g(200), undefined]);
  assert.throws(() => run(w, "commit_food_log", { batchId: w.pending.id }), /Resolve every/);
  assert.equal(w.meals.length, 0);
});
test("15: ambiguous egg size asks for a verified portion", () => {
  const w = draft([egg], [{ amount: 3, unit: "piece" }]);
  assert.match(w.pending.items[0].issue, /Choose a serving/);
  assert.equal(w.meals.length, 0);
});
test("16: quantity clarification makes pending item ready", () => {
  let w = draft([egg], [{ amount: 3, unit: "piece" }]);
  w = run(w, "set_pending_quantity", {
    itemId: w.pending.items[0].id,
    quantity: { amount: 3, unit: "piece", portionId: "large" },
  });
  assert.equal(w.pending.items[0].issue, undefined);
  w = run(w, "commit_food_log", { batchId: w.pending.id });
  assert.equal(first(w).grams, 150);
});
test("17: raw versus cooked record is preserved explicitly", () => {
  const raw = {
    ...chicken,
    id: "usda:4",
    name: "Chicken breast, raw",
    per100g: { ...chicken.per100g, calories: 120 },
    source: { ...chicken.source, fdcId: 4 },
  };
  const w = logged([raw, chicken], [g(100), g(100)]);
  assert.equal(w.meals[0].entries[0].nutrients.calories, 120);
  assert.equal(w.meals[0].entries[1].nutrients.calories, 165);
});
test("18: milliliters never default to equal grams", () =>
  assert.throws(() => gramsFor(chicken, { amount: 5, unit: "ml" }), /No verified/));
test("19: verified density determines ml calculation", () => {
  const oil = {
    ...chicken,
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    portions: [{ id: "ml", label: "USDA tablespoon", grams: 13.5, amount: 14.7868, unit: "ml" }],
  };
  const n = calculate(oil, { amount: 5, unit: "ml", portionId: "ml" });
  assert.ok(Math.abs(n.grams - 4.564884) < 0.00001);
});
test("20: nutrition totals do not sum rounded display values", () => {
  assert.equal(
    sum([
      { calories: 0.04, protein: 0, carbs: 0, fat: 0 },
      { calories: 0.04, protein: 0, carbs: 0, fat: 0 },
    ]).calories,
    0.08,
  );
});
test("21: personal memory corrects same key without duplicates", () => {
  let w = run(emptyWorkspace(), "remember_fact", { key: "Favorite color", value: "Blue" });
  w = run(w, "remember_fact", { key: "favorite_color", value: "Sage green" });
  assert.deepEqual(w.memories, [{ key: "favorite_color", value: "Sage green" }]);
});
test("22: forget memory removes only requested fact", () => {
  let w = run(emptyWorkspace(), "remember_fact", { key: "a", value: "A" });
  w = run(w, "remember_fact", { key: "b", value: "B" });
  w = run(w, "forget_fact", { key: "a" });
  assert.equal(w.memories[0].key, "b");
});
test("23: chosen protein target changes remaining server value", () => {
  let w = logged();
  w = run(w, "set_goals", { protein: 160 });
  assert.equal(context(w, "2026-10-09").remaining.protein, 160 - 62.04);
  assert.equal(w.goalsConfigured, true);
});
test("24: preferences and targets survive refresh", () => {
  let w = run(emptyWorkspace(), "set_goals", { protein: 160 });
  w = run(w, "remember_fact", { key: "usual_yogurt", value: "150g" });
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});
test("25: updating saved meal requires explicit replacement", () => {
  let w = logged();
  w = run(w, "save_meal", { mealId: w.meals[0].id, name: "Lunch" });
  assert.throws(
    () => run(w, "save_meal", { mealId: w.meals[0].id, name: "lunch" }),
    /Ask before replacing/,
  );
});
test("26: replacing reusable meal never changes historical food logs", () => {
  let w = logged();
  w = run(w, "save_meal", { mealId: w.meals[0].id, name: "Lunch" });
  w = run(w, "copy_meal", { mealId: w.meals[0].id, date: "2026-10-10" });
  w = run(w, "update_quantity", { entryId: w.meals[1].entries[0].id, quantity: g(180) });
  w = run(w, "save_meal", { mealId: w.meals[1].id, name: "Lunch", replace: true });
  assert.equal(first(w).grams, 200);
  assert.equal(w.savedMeals[0].entries[0].grams, 180);
});
test("27: forgetting saved meal preserves actual consumption", () => {
  let w = logged();
  w = run(w, "save_meal", { mealId: w.meals[0].id, name: "Lunch" });
  w = run(w, "forget_saved_meal", { savedMealId: w.savedMeals[0].id });
  assert.equal(w.meals.length, 1);
  assert.equal(w.savedMeals.length, 0);
});
test("28: foreign entry IDs are rejected", () => {
  const w = logged();
  assert.throws(
    () => run(w, "update_quantity", { entryId: "other-user-entry", quantity: g(100) }),
    /not found/,
  );
});
test("29: canceled draft never changes totals", () => {
  const w = run(draft(), "cancel_pending", {});
  assert.equal(w.pending, null);
  assert.equal(w.meals.length, 0);
});
test("30: restarting during pending workflow is rejected", () => {
  const w = draft();
  assert.throws(
    () => run(w, "start_food_log", { items: [{ query: "Rice" }] }),
    /existing food draft/,
  );
});
test("31: impossible calendar dates are rejected", () =>
  assert.throws(() => logged(undefined, undefined, "2026-02-30"), /real date/));
test("32: negative, zero, NaN and huge quantities rejected", () => {
  for (const amount of [-1, 0, NaN, Infinity, 10001])
    assert.throws(() => quantity({ amount, unit: "g" }));
});
test("33: old undo operation cannot overwrite newer changes", () => {
  let w = logged();
  const id = context(w).undoableOperation;
  w = run(w, "update_quantity", { entryId: first(w).id, quantity: g(180) });
  assert.throws(() => run(w, "undo", { operationId: id }), /latest operation/);
});
test("34: saved confirmed food works without API call", () => {
  let w = logged();
  w = run(w, "start_food_log", {
    items: [{ query: "My chicken", quantity: g(180) }],
    date: "2026-10-10",
  });
  w = run(w, "use_saved_food", { itemId: w.pending.items[0].id, foodId: chicken.id });
  w = run(w, "commit_food_log", { batchId: w.pending.id });
  assert.equal(w.meals[1].entries[0].nutrients.calories, 297);
});
test("35: local dates follow timezone across midnight", () => {
  const now = new Date("2026-10-09T22:00:00Z");
  assert.equal(localDate("Asia/Riyadh", now), "2026-10-10");
  assert.equal(localDate("America/New_York", now), "2026-10-09");
});
test("36: invalid timezone rejected without mutating original", () => {
  const w = emptyWorkspace();
  assert.throws(() => run(w, "set_timezone", { timezone: "invalid" }), /Invalid IANA/);
  assert.equal(w.version, 0);
});
test("37: missing USDA macro is not fabricated as zero", () => {
  assert.throws(
    () =>
      normalizeFood({
        fdcId: 1,
        description: "Food",
        dataType: "Foundation",
        foodNutrients: [{ nutrient: { id: 1008, unitName: "kcal" }, amount: 100 }],
      }),
    /missing a required nutrient/,
  );
});
test("38: USDA energy units are validated", () => {
  assert.throws(
    () =>
      normalizeFood({
        fdcId: 1,
        foodNutrients: [{ nutrient: { id: 1008, unitName: "kJ" }, amount: 100 }],
      }),
    /missing/,
  );
});
test("39: nutrition API outage leaves draft intact", async () => {
  const old = globalThis.fetch;
  const w = draft([chicken], [undefined]);
  globalThis.fetch = async () => {
    throw new Error("network offline");
  };
  try {
    await assert.rejects(searchFoods("unique unavailable food"), /could not be reached/);
    assert.equal(w.meals.length, 0);
    assert.ok(w.pending);
  } finally {
    globalThis.fetch = old;
  }
});
test("40: adding to a historical meal cannot silently change its date", () => {
  const w = logged(undefined, undefined, "2026-10-08");
  assert.throws(
    () =>
      run(w, "start_food_log", {
        mealId: w.meals[0].id,
        date: "2026-10-09",
        items: [{ query: "banana" }],
      }),
    /existing meal’s date/,
  );
});

test("adding to a historical meal inherits its date and name when omitted", () => {
  const initial = logged(undefined, undefined, "2026-10-08");
  const w = run(initial, "start_food_log", {
    mealId: initial.meals[0].id,
    items: [{ query: "Banana", quantity: g(100) }],
  });
  assert.equal(w.pending.date, "2026-10-08");
  assert.equal(w.pending.mealName, "Lunch");
});
test("searching for a different food clears the prior selection before a portion can be confirmed", () => {
  let w = draft();
  const itemId = w.pending.items[0].id;
  w = run(w, "set_candidates", {
    itemId,
    query: "Banana",
    candidates: [{ fdcId: banana.source.fdcId, name: banana.name, dataType: "SR Legacy" }],
  });
  assert.equal(w.pending.items[0].query, "Banana");
  assert.equal(w.pending.items[0].food, undefined);
  w = run(w, "set_pending_quantity", { itemId, quantity: g(100) });
  assert.throws(() => run(w, "commit_food_log", { batchId: w.pending.id }), /Resolve every food/);
  w = run(w, "resolve_food", { itemId, food: banana });
  w = run(w, "commit_food_log", { batchId: w.pending.id });
  assert.equal(first(w).food.id, banana.id);
  assert.equal(first(w).nutrients.calories, 89);
});
test("undoing a portion correction preserves a subsequently selected timezone", () => {
  let w = logged();
  w = run(w, "update_quantity", { entryId: first(w).id, quantity: g(180) });
  w = run(w, "set_timezone", { timezone: "America/New_York" });
  w = run(w, "undo", { operationId: context(w).undoableOperation });
  assert.equal(first(w).grams, 200);
  assert.equal(w.timezone, "America/New_York");
});
const validRawFood = () => ({
  fdcId: 1,
  description: "Test food",
  dataType: "Foundation",
  foodNutrients: [
    { nutrient: { id: 1008, unitName: "kcal" }, amount: 100 },
    { nutrient: { id: 1003, unitName: "g" }, amount: 10 },
    { nutrient: { id: 1005, unitName: "g" }, amount: 10 },
    { nutrient: { id: 1004, unitName: "g" }, amount: 10 },
  ],
});
test("invalid upstream portion weights are excluded from usable conversions", () => {
  const raw = validRawFood();
  raw.foodPortions = [
    { id: 1, gramWeight: Infinity, amount: 1, modifier: "cup" },
    { id: 2, gramWeight: 200, amount: Infinity, modifier: "cup" },
    { id: 3, gramWeight: 200, amount: 1, modifier: "cup" },
  ];
  const food = normalizeFood(raw);
  assert.equal(food.portions.length, 2);
  for (const p of food.portions) {
    assert.ok(Number.isFinite(p.grams));
    assert.ok(Number.isFinite(p.amount));
  }
});
test("a malformed upstream nutrient unit produces a usable validation error", () => {
  const raw = validRawFood();
  delete raw.foodNutrients[0].nutrient.unitName;
  assert.throws(() => normalizeFood(raw), /missing a required nutrient/);
});

test("replacing a usual meal requires a true confirmation flag", () => {
  let w = logged();
  w = run(w, "save_meal", { mealId: w.meals[0].id, name: "Usual lunch" });
  const saved = structuredClone(w.savedMeals[0]);
  for (const replace of ["false", "true", 1, {}, []]) {
    assert.throws(
      () => run(w, "save_meal", { mealId: w.meals[0].id, name: "Usual lunch", replace }),
      /Ask before replacing/,
    );
    assert.deepEqual(w.savedMeals[0], saved);
  }
});
