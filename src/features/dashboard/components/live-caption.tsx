import type { VoiceCaption } from "@/lib/realtime/types";
import { captionSegments } from "@/lib/realtime/captions";
import type { Transcript } from "@/hooks/use-sarjy";
import { useEffect, useRef } from "react";
import styles from "./live-caption.module.css";

export function LiveCaption({
  caption,
  fallback,
}: {
  caption: VoiceCaption | null;
  fallback?: Transcript;
}) {
  const text = caption ? caption.text : fallback?.text;
  const speaker = caption?.speaker ?? fallback?.role;
  const paragraph = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const active = paragraph.current?.querySelector('[data-state="active"]');
    const container = paragraph.current?.parentElement;
    if (!active || !container) return;
    const word = active.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    if (word.bottom > bounds.bottom - 12) container.scrollTop += word.bottom - bounds.bottom + 12;
    else if (word.top < bounds.top + 12) container.scrollTop -= bounds.top - word.top + 12;
  }, [caption?.activeWord, text]);
  if (!text) {
    return (
      <p>
        {speaker === "user" ? (
          "Listening…"
        ) : (
          <>
            Food logging can feel like a chore.
            <br />
            Let’s make it a conversation.
          </>
        )}
      </p>
    );
  }

  return (
    <p ref={paragraph} className={styles.caption}>
      <small>{speaker === "user" ? "You" : "Sarjy"}</small>
      <span>
        {captionSegments(text).map(({ text: segment, wordIndex }, index) => (
          <span
            key={index}
            className={styles.word}
            data-state={
              wordIndex !== null && caption && caption.activeWord >= 0
                ? wordIndex === caption.activeWord
                  ? "active"
                  : wordIndex > caption.activeWord
                    ? "upcoming"
                    : "spoken"
                : "spoken"
            }
          >
            {segment}
          </span>
        ))}
      </span>
    </p>
  );
}
