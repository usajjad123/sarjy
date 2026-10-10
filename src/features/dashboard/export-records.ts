import type { Workspace } from "@/features/food-logging/model";

export function exportRecords(workspace: Workspace, date: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `sarjy-fit-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
