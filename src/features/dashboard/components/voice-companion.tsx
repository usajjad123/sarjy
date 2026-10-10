import { useState, type FormEvent } from "react";
import { VoiceParticipant } from "@/components/voice-participant";
import type { SarjyVoice } from "../types";
import { actionLabels as labels } from "../action-labels";
import { Icon } from "./icon";
export function VoiceCompanion({
  voice,
  ready,
  lookup,
}: {
  voice: SarjyVoice;
  ready: boolean;
  lookup: string;
}) {
  const [message, setMessage] = useState("");
  const latest = voice.transcript.at(-1);
  const visibleTool =
    voice.tool && !["get_nutrition_context", "remember_fact", "forget_fact"].includes(voice.tool)
      ? voice.tool
      : null;
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (await voice.send(message)) setMessage("");
  };
  return (
    <aside className="fit-companion" id="companion">
      <div className="companion-heading">
        <p className="fit-eyebrow">YOUR EVERYDAY COMPANION</p>
        <span className={`connection-dot ${voice.connected ? "online" : ""}`} />
      </div>
      <VoiceParticipant
        speaker="assistant"
        level={voice.assistantLevel}
        speaking={voice.speaking.assistant}
        connected={voice.connected}
        microphone={voice.mic}
        thinking={voice.state === "thinking" || !!voice.tool}
        subtitle="A little help. A little less effort."
      />
      <div className="companion-caption" aria-live="polite">
        {visibleTool ? (
          <p className="working-caption">{labels[visibleTool] || "Updating your records"}…</p>
        ) : latest ? (
          <p>
            <small>{latest.role === "user" ? "You" : "Sarjy"}</small>
            {latest.text}
          </p>
        ) : (
          <p>
            Food logging can feel like a chore.
            <br />
            Let’s make it a conversation.
          </p>
        )}
      </div>
      <div className="fit-voice-controls">
        {voice.connected ? (
          <>
            <button
              className={`secondary mic-toggle ${voice.mic ? "on" : ""}`}
              disabled={voice.micBusy}
              onClick={voice.toggleMic}
            >
              <Icon name="mic" />
              {voice.mic ? "Mic on" : "Mic off"}
            </button>
            <button className="secondary" onClick={voice.end}>
              End
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={!ready || voice.state === "connecting"}
            onClick={() => voice.start(true)}
          >
            <Icon name="mic" />
            {voice.state === "connecting" ? "Connecting…" : "Let’s talk"}
          </button>
        )}
      </div>
      {voice.mic && (
        <div className="user-activity" data-speaking={voice.speaking.user}>
          <span className="status-dot active" />
          {voice.speaking.user ? "You’re speaking" : "Listening · You can interrupt"}
        </div>
      )}
      <form className="fit-message-form" onSubmit={send}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Message Sarjy"
          placeholder="Or type what you ate…"
        />
        <button
          aria-label="Send message"
          disabled={!ready || !message.trim() || voice.state === "connecting"}
        >
          <Icon name="arrow" />
        </button>
      </form>
      <div className="conversation-starters">
        <p>TRY SAYING</p>
        {[
          "How much protein have I eaten today?",
          "Undo my last change.",
          "Remember this as my usual lunch.",
        ].map((p) => (
          <button
            key={p}
            disabled={!ready || voice.state === "connecting"}
            onClick={() => voice.send(p)}
          >
            {p}
            <span>↗</span>
          </button>
        ))}
      </div>
      <details className="fit-history">
        <summary>
          Conversation <span>{voice.transcript.length}</span>
        </summary>
        <div>
          {voice.transcript.map((t, i) => (
            <article key={i} className={t.role}>
              <strong>{t.role === "user" ? "You" : "Sarjy"}</strong>
              <p>{t.text}</p>
            </article>
          ))}
        </div>
      </details>
      <div className="companion-footer">
        <Icon name="leaf" />
        <p>
          No judgment. No unsolicited advice.
          <br />
          Just your food, clearly recorded.
        </p>
      </div>
      {lookup === "demo" && (
        <small className="demo-key-note">USDA demo access · Limited lookup quota</small>
      )}
    </aside>
  );
}
