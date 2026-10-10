import type { Entry } from "@/features/food-logging/model";
import { rounded } from "@/features/nutrition/engine";
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const formatNumber = (value: number) => numberFormatter.format(rounded(value));
export function formatQuantity(entry: Entry) {
  const { amount, unit, portionId } = entry.quantity;
  const portion = portionId
    ? (entry.food.portions.find((item) => item.id === portionId)?.label ?? "USDA portion")
    : null;
  return `${formatNumber(amount)} ${unit}${portion ? ` · ${portion}` : ""}`;
}
