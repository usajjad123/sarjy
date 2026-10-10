"use client";

import Link from "next/link";
import { useState } from "react";
import { useDiaryWorkspace } from "./use-diary-workspace";
import type { DashboardDialog as DialogState, DashboardView } from "./types";
import { exportRecords } from "./export-records";
import { DashboardNavigation } from "./components/navigation";
import { DashboardHeading } from "./components/dashboard-heading";
import { DiaryDateNavigation } from "./components/diary-date-navigation";
import { NutritionSummary } from "./components/nutrition-summary";
import { PendingDraft } from "./components/pending-draft";
import { FoodDiary } from "./components/food-diary";
import { FoodLibrary } from "./components/food-library";
import { PersonalMemory } from "./components/personal-memory";
import { VoiceCompanion } from "./components/voice-companion";
import { VoiceInvitation } from "./components/voice-invitation";
import { MobileVoiceControls } from "./components/mobile-voice-controls";
import { DashboardDialog } from "./components/dashboard-dialog";

export function SarjyDashboard() {
  const diary = useDiaryWorkspace();
  const { workspace, summary, voice } = diary;
  const [view, setView] = useState<DashboardView>("today");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  return (
    <div className="fit-app">
      <DashboardNavigation view={view} onChange={setView} />
      <div className="fit-content">
        <header className="fit-header">
          <Link href="/" className="fit-wordmark">
            sarjy<span>fit</span>
          </Link>
          <p>Eat normally. Track effortlessly.</p>
          <span className="private-badge">
            <span className="status-dot active" />
            {diary.storage === "supabase" ? "Your private space." : "Your browser. Your memory."}
          </span>
        </header>
        <div className="fit-columns">
          <main className="fit-main">
            <DashboardHeading view={view}>
              {view === "today" && (
                <DiaryDateNavigation
                  date={diary.date}
                  today={diary.today}
                  mealDates={workspace?.meals.map((meal) => meal.date) ?? []}
                  onChange={diary.setDate}
                />
              )}
            </DashboardHeading>
            {(diary.error || voice.error) && (
              <div className="fit-error" role="alert">
                {diary.error || voice.error}
                <button onClick={diary.clearError} aria-label="Dismiss error">
                  ×
                </button>
              </div>
            )}
            {diary.status && (
              <p className="action-status" role="status">
                <span className="status-dot active" />
                {diary.status}
              </p>
            )}
            {!workspace ? (
              <div className="empty-card">
                {diary.error
                  ? "Your records could not be loaded. Reload to try again."
                  : "Getting your day ready…"}
              </div>
            ) : (
              <>
                {workspace.pending && (
                  <PendingDraft
                    pending={workspace.pending}
                    busy={diary.busy}
                    runAction={diary.runAction}
                  />
                )}
                {view === "today" && summary && (
                  <>
                    <NutritionSummary
                      summary={summary}
                      onEditGoals={() => setDialog({ type: "goals" })}
                    />
                    <VoiceInvitation voice={voice} />
                    <FoodDiary
                      summary={summary}
                      isToday={diary.date === diary.today}
                      hasPending={!!workspace.pending}
                      busy={diary.busy}
                      runAction={diary.runAction}
                      onAddFood={() => setDialog({ type: "log" })}
                      onEdit={(entry) => setDialog({ type: "edit", entry })}
                      onSave={(meal) => setDialog({ type: "save", meal })}
                    />
                    <div className="diary-footer">
                      <span>
                        Nutrition: USDA FoodData Central · Values vary by exact food and
                        preparation.
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
                    onAddMemory={() => setDialog({ type: "memory" })}
                  />
                )}
              </>
            )}
          </main>
          <VoiceCompanion voice={voice} ready={!!workspace} lookup={diary.lookup} />
        </div>
        <footer className="fit-bottom">
          <span>sarjy fit · Made for the way you actually eat.</span>
          <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer">
            Powered by USDA FoodData Central ↗
          </a>
        </footer>
      </div>
      <MobileVoiceControls voice={voice} ready={!!workspace} />
      {dialog && workspace && (
        <DashboardDialog
          key={dialog.type}
          dialog={dialog}
          date={diary.date}
          goals={workspace.goals}
          busy={diary.busy}
          error={diary.error}
          runAction={diary.runAction}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
