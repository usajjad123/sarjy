import { context, text, type Action } from "@/features/food-logging/model";
import { checkOrigin, errorResponse, json } from "@/features/food-logging/http";
import {
  currentUser,
  limitRequests,
  mutateWorkspace,
  readWorkspace,
} from "@/features/food-logging/store";
import { NutritionError } from "@/features/nutrition/engine";
import { getFood, searchFoods } from "@/features/food/usda";
export const runtime = "nodejs";
const mutations = [
  "start_food_log",
  "set_pending_quantity",
  "commit_food_log",
  "cancel_pending",
  "update_quantity",
  "remove_entry",
  "undo",
  "save_meal",
  "log_saved_meal",
  "copy_meal",
  "forget_saved_meal",
  "forget_food",
  "use_saved_food",
  "set_goals",
  "set_timezone",
  "remember_fact",
  "forget_fact",
];
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const raw = await request.text();
    if (raw.length > 30000) throw new NutritionError("Command is too large", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new NutritionError("Invalid command JSON");
    }
    if (
      !body ||
      typeof body.name !== "string" ||
      !body.args ||
      typeof body.args !== "object" ||
      Array.isArray(body.args)
    )
      throw new NutritionError("Invalid command");
    const id = await currentUser();
    const [, current] = await Promise.all([limitRequests(id), readWorkspace(id)]);
    if (body.name === "get_nutrition_context")
      return json({
        workspace: current,
        context: context(current, body.args.date),
        status: "current",
        saved: false,
      });
    if (
      !Number.isInteger(body.expectedVersion) ||
      typeof body.callId !== "string" ||
      !body.callId ||
      body.callId.length > 200
    )
      throw new NutritionError("Include version and idempotency key");
    if (current.appliedCalls.includes(body.callId))
      return json({
        workspace: current,
        context: context(current),
        status: "already_applied",
        saved: true,
      });
    if (current.version !== body.expectedVersion)
      throw new NutritionError("Records changed. Read current state before retrying.", 409);
    let action: Action = { name: body.name, args: body.args };
    if (body.name === "search_food") {
      const item = current.pending?.items.find((i) => i.id === body.args.itemId);
      if (!item) throw new NutritionError("Draft item not found", 404);
      const query = text(body.args.query ?? item.query, "Food description");
      const candidates = await searchFoods(query);
      action = { name: "set_candidates", args: { itemId: item.id, query, candidates } };
    } else if (body.name === "resolve_food") {
      const item = current.pending?.items.find((i) => i.id === body.args.itemId);
      if (!item?.candidates.some((c) => c.fdcId === body.args.fdcId))
        throw new NutritionError("Choose a USDA result from this draft");
      action = {
        name: "resolve_food",
        args: {
          itemId: item.id,
          food: await getFood(body.args.fdcId),
          ...(body.args.quantity ? { quantity: body.args.quantity } : {}),
        },
      };
    } else if (!mutations.includes(body.name)) throw new NutritionError("Unknown food command");
    const workspace = await mutateWorkspace(id, body.expectedVersion, action, body.callId, current);
    return json({
      workspace,
      context: context(workspace),
      status: workspace.pending ? "draft" : "saved",
      saved: !workspace.pending,
      persisted: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
