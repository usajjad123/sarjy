import type { DashboardDialog } from "../types";
import type { useDiaryWorkspace } from "../use-diary-workspace";
import { exportRecords } from "../export-records";
import { PendingDraft } from "./pending-draft";
import { FoodDiary } from "./food-diary";
import { FoodLibrary } from "./food-library";
import { PersonalMemory } from "./personal-memory";
import type { DashboardView } from "../types";

export function DiaryScreen({
  diary,
  view,
  onDialog,
}: {
  diary: ReturnType<typeof useDiaryWorkspace>;
  view: DashboardView;
  onDialog: (dialog: DashboardDialog) => void;
}) {
  const { workspace, summary } = diary;
  if (!workspace) return null;
  return (
    <>
      {workspace.pending && (
        <PendingDraft pending={workspace.pending} busy={diary.busy} runAction={diary.runAction} />
      )}
      {view === "today" && summary && (
        <>
          <FoodDiary
            summary={summary}
            isToday={diary.date === diary.today}
            hasPending={!!workspace.pending}
            busy={diary.busy}
            runAction={diary.runAction}
            onAddFood={() => onDialog({ type: "log" })}
            onEdit={(entry) => onDialog({ type: "edit", entry })}
            onSave={(meal) => onDialog({ type: "save", meal })}
          />
          <div className="diary-footer">
            <span>
              Nutrition: USDA FoodData Central · Values vary by exact food and preparation.
            </span>
            <button onClick={() => exportRecords(workspace, diary.date)}>
              Export my records ↗
            </button>
          </div>
        </>
      )}
      {view === "library" && (
        <FoodLibrary
          workspace={workspace}
          today={diary.today}
          busy={diary.busy}
          runAction={diary.runAction}
        />
      )}
      {view === "memory" && (
        <PersonalMemory
          workspace={workspace}
          busy={diary.busy}
          runAction={diary.runAction}
          onAddMemory={() => onDialog({ type: "memory" })}
        />
      )}
    </>
  );
}
