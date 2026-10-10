import type { Entry, Meal, Workspace } from "@/features/food-logging/model";
export type DashboardView = "today" | "library" | "memory";
export type FoodAction = (name: string, args: Record<string, unknown>) => Promise<Workspace | null>;
export type DashboardDialog =
  | { type: "log" | "goals" | "memory" }
  | { type: "edit"; entry: Entry }
  | { type: "save"; meal: Meal };
export type SarjyVoice = ReturnType<typeof import("@/hooks/use-sarjy").useSarjy>;
