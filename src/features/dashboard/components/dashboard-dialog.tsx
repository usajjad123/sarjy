import type { Nutrients } from "@/features/nutrition/engine";
import type { DashboardDialog as DialogState } from "../types";
import type { ActionDialogProps } from "./form-dialog";
import { LogFoodDialog } from "./log-food-dialog";
import { GoalsDialog } from "./goals-dialog";
import { MemoryDialog } from "./memory-dialog";
import { EditPortionDialog } from "./edit-portion-dialog";
import { SaveMealDialog } from "./save-meal-dialog";
export function DashboardDialog({
  dialog,
  date,
  goals,
  ...actions
}: ActionDialogProps & { dialog: DialogState; date: string; goals: Nutrients }) {
  switch (dialog.type) {
    case "log":
      return <LogFoodDialog {...actions} date={date} />;
    case "goals":
      return <GoalsDialog {...actions} goals={goals} />;
    case "memory":
      return <MemoryDialog {...actions} />;
    case "edit":
      return <EditPortionDialog {...actions} entry={dialog.entry} />;
    case "save":
      return <SaveMealDialog {...actions} meal={dialog.meal} />;
  }
}
