"use client";

import Link from "next/link";
import { useState } from "react";
import { useDiaryWorkspace } from "./use-diary-workspace";
import type { DashboardDialog as DialogState, DashboardView } from "./types";
import { DashboardNavigation } from "./components/navigation";
import { DashboardHeading } from "./components/dashboard-heading";
import { DiaryDateNavigation } from "./components/diary-date-navigation";
import { NutritionSummary } from "./components/nutrition-summary";
import { VoiceCompanion } from "./components/voice-companion";
import { MobileVoiceControls } from "./components/mobile-voice-controls";
import { DashboardDialog } from "./components/dashboard-dialog";
import { DiaryScreen } from "./components/diary-screen";
import { RecentMeals } from "./components/recent-meals";
import { ConversationResult } from "./components/conversation-result";
import styles from "./components/dashboard-layout.module.css";

export function SarjyDashboard() {
  const diary = useDiaryWorkspace();
  const { workspace, summary, voice } = diary;
  const [view, setView] = useState<DashboardView>("today");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [openedVersion, setOpenedVersion] = useState(0);

  const openConversation = (microphone: boolean) => {
    if (!workspace) return;
    if (!expanded) setOpenedVersion(workspace.version);
    setExpanded(true);
    if (!microphone || voice.state === "connecting" || voice.micBusy) return;
    if (!voice.connected) void voice.start(true);
    else if (!voice.mic) void voice.toggleMic();
  };
  const returnToDay = () => {
    setView("today");
    setExpanded(false);
  };
  const endConversation = () => {
    voice.end();
    returnToDay();
  };

  return (
    <div className={`fit-app ${styles.app}`}>
      <div inert={expanded}>
        <DashboardNavigation view={view} onChange={setView} />
      </div>
      <div className={`fit-content ${styles.content}`}>
        <header className="fit-header" inert={expanded}>
          <Link href="/" className="fit-wordmark">
            sarjy<span>fit</span>
          </Link>
          <p>Eat normally. Track effortlessly.</p>
          {view !== "today" && (
            <button
              data-open-conversation
              className={styles.headerTalk}
              disabled={!workspace}
              onClick={() => openConversation(true)}
            >
              Talk to Sarjy ↗
            </button>
          )}
          <span className="private-badge">
            <span className="status-dot active" />
            {diary.storage === "supabase" ? "Your private space." : "Your browser. Your memory."}
          </span>
        </header>
        <main className={`fit-main ${styles.main}`}>
          <div inert={expanded}>
            {(diary.error || voice.error) && (
              <div className="fit-error" role="alert">
                {diary.error || voice.error}
                <button
                  onClick={() => {
                    diary.clearError();
                    voice.clearError();
                  }}
                  aria-label="Dismiss error"
                >
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
          </div>
          <div className={`${styles.hero} ${view !== "today" ? styles.secondaryView : ""}`}>
            <div className={styles.companionSlot} data-expanded={expanded}>
              <VoiceCompanion
                voice={voice}
                ready={!!workspace}
                lookup={diary.lookup}
                expanded={expanded}
                onOpen={openConversation}
                onClose={returnToDay}
                onEnd={endConversation}
              >
                {workspace && (
                  <ConversationResult
                    workspace={workspace}
                    change={diary.change}
                    openedVersion={openedVersion}
                    busy={diary.busy}
                    runAction={diary.runAction}
                  />
                )}
                {workspace?.pending && (
                  <button className={styles.reviewDraft} onClick={returnToDay}>
                    Food draft in progress · Review details ↗
                  </button>
                )}
              </VoiceCompanion>
            </div>
            <div className={styles.overview} inert={expanded}>
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
              {!workspace ? (
                <div className="empty-card">
                  {diary.error
                    ? "Your records could not be loaded. Reload to try again."
                    : "Getting your day ready…"}
                </div>
              ) : (
                view === "today" &&
                summary && (
                  <>
                    <NutritionSummary
                      summary={summary}
                      onEditGoals={() => setDialog({ type: "goals" })}
                    />
                    <RecentMeals meals={summary.meals} />
                  </>
                )
              )}
            </div>
          </div>
          <div className={styles.records} inert={expanded}>
            <DiaryScreen diary={diary} view={view} onDialog={setDialog} />
          </div>
        </main>
        <footer className="fit-bottom" inert={expanded}>
          <span>sarjy fit · Made for the way you actually eat.</span>
          <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noreferrer">
            Powered by USDA FoodData Central ↗
          </a>
        </footer>
      </div>
      {!expanded && (
        <MobileVoiceControls
          voice={voice}
          ready={!!workspace}
          onOpen={() => openConversation(true)}
        />
      )}
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
