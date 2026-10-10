import { useState, type FormEvent } from "react";
import type { SarjyVoice } from "../types";
import { Icon } from "./icon";
import styles from "./voice-companion.module.css";

export function ConversationTools({
  voice,
  ready,
  lookup,
  expanded,
  onOpen,
}: {
  voice: SarjyVoice;
  ready: boolean;
  lookup: string;
  expanded: boolean;
  onOpen: (microphone: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const connecting = voice.state === "connecting";
  const send = async (event: FormEvent) => {
    event.preventDefault();
    onOpen(false);
    if (await voice.send(message)) setMessage("");
  };
  return (
    <div className={styles.conversationTools} hidden={!expanded}>
      <form className={styles.messageForm} onSubmit={send}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-label="Message Sarjy"
          placeholder="Or type what you ate…"
        />
        <button
          aria-label="Send message"
          disabled={!ready || !message.trim() || connecting || voice.micBusy}
        >
          <Icon name="arrow" />
        </button>
      </form>
      <details className={styles.history}>
        <summary>
          Conversation <span>{voice.transcript.length}</span>
        </summary>
        <div>
          {voice.transcript.map((item, index) => (
            <article key={index} data-speaker={item.role}>
              <strong>{item.role === "user" ? "You" : "Sarjy"}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </details>
      {lookup === "demo" && (
        <small className={styles.demo}>USDA demo access · Limited lookup quota</small>
      )}
    </div>
  );
}
