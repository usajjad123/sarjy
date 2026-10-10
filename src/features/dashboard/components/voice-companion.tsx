import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SarjyAvatar } from "@/components/sarjy-avatar";
import type { SarjyVoice } from "../types";
import { useModalFocus } from "@/hooks/use-modal-focus";
import { actionLabels } from "../action-labels";
import { Icon } from "./icon";
import { LiveCaption } from "./live-caption";
import { ConversationTools } from "./conversation-tools";
import styles from "./voice-companion.module.css";

export function VoiceCompanion({
  voice,
  ready,
  lookup,
  expanded,
  onOpen,
  onClose,
  onEnd,
  children,
}: {
  voice: SarjyVoice;
  ready: boolean;
  lookup: string;
  expanded: boolean;
  onOpen: (microphone: boolean) => void;
  onClose: () => void;
  onEnd: () => void;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const panel = useModalFocus(expanded, onClose, "[data-open-conversation]");
  const visibleTool =
    voice.tool && !["get_nutrition_context", "remember_fact", "forget_fact"].includes(voice.tool)
      ? voice.tool
      : null;
  const connecting = voice.state === "connecting";

  return (
    <div className={styles.slot}>
      <motion.section
        ref={panel}
        layout={!reduced}
        layoutRoot={expanded}
        layoutScroll
        layoutDependency={expanded}
        transition={{ layout: { duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } }}
        style={{ borderRadius: expanded ? 0 : 28 }}
        className={`${styles.panel} ${expanded ? styles.expanded : ""}`}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? true : undefined}
        aria-label={expanded ? "Conversation with Sarjy" : "Your companion Sarjy"}
        tabIndex={-1}
        id="companion"
      >
        <motion.div layout={reduced ? false : "position"} className={styles.topbar}>
          <span className="fit-eyebrow">
            {expanded ? "JUST YOU & SARJY" : "YOUR EVERYDAY COMPANION"}
          </span>
          {expanded ? (
            <button data-conversation-back className={styles.back} onClick={onClose}>
              <span aria-hidden="true">←</span> Back to my day
            </button>
          ) : (
            <span className={`connection-dot ${voice.connected ? "online" : ""}`} />
          )}
        </motion.div>
        <motion.div layout={reduced ? false : "position"} className={styles.canvas}>
          <SarjyAvatar
            level={voice.assistantLevel}
            speaking={voice.speaking.assistant}
            connected={voice.connected}
            thinking={voice.state === "thinking" || !!visibleTool}
          />
          <div className={styles.caption} aria-live="off">
            {visibleTool && !voice.speaking.user && !voice.speaking.assistant ? (
              <p>{actionLabels[visibleTool] || "Updating your records"}…</p>
            ) : voice.caption || voice.transcript.length ? (
              <LiveCaption caption={voice.caption} fallback={voice.transcript.at(-1)} />
            ) : (
              <p>
                Tell me what you ate.
                <br />
                We’ll take care of the details together.
              </p>
            )}
          </div>
        </motion.div>
        <motion.div layout={reduced ? false : "position"} className={styles.interaction}>
          {expanded && voice.error && (
            <p className={styles.error} role="alert">
              {voice.error}
              <button onClick={voice.clearError} aria-label="Dismiss conversation error">
                ×
              </button>
            </p>
          )}
          <div className={styles.controls}>
            {expanded && voice.connected ? (
              <>
                <button
                  className={`primary ${styles.mic}`}
                  disabled={voice.micBusy}
                  aria-pressed={voice.mic}
                  onClick={voice.toggleMic}
                >
                  <Icon name="mic" />
                  {voice.micBusy ? "One moment…" : voice.mic ? "Mic on" : "Mic off"}
                </button>
                <button className="secondary" onClick={onEnd}>
                  End conversation
                </button>
              </>
            ) : (
              <button
                className="primary"
                data-open-conversation={!expanded ? true : undefined}
                disabled={!ready || connecting || voice.micBusy}
                onClick={() => onOpen(true)}
              >
                <Icon name="mic" />
                {connecting
                  ? "Connecting…"
                  : voice.connected
                    ? "Continue conversation"
                    : "Talk to Sarjy"}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          <p className={styles.activity} data-speaking={voice.speaking.user}>
            {connecting
              ? "Connecting to Sarjy…"
              : voice.speaking.assistant
                ? "Sarjy is speaking"
                : voice.state === "thinking" || visibleTool
                  ? "Thinking it through…"
                  : voice.mic
                    ? voice.speaking.user
                      ? "You’re speaking"
                      : "Mic on · You can interrupt"
                    : voice.connected
                      ? "Microphone off · Type or turn it on"
                      : "No judgment. Just a conversation."}
            {voice.mic && voice.captionStatus === "delayed" && " · Captions appear after your turn"}
          </p>
          {!expanded && (
            <button className={styles.typeLink} onClick={() => onOpen(false)} disabled={!ready}>
              Prefer to type?
            </button>
          )}
          {expanded && <div className={styles.result}>{children}</div>}
        </motion.div>
        <ConversationTools
          voice={voice}
          ready={ready}
          lookup={lookup}
          expanded={expanded}
          onOpen={onOpen}
        />
      </motion.section>
    </div>
  );
}
