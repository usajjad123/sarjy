import type { VoiceCaption } from "@/lib/realtime/types";
import type { Transcript } from "@/hooks/use-sarjy";
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
    <p className={styles.caption}>
      <small>{speaker === "user" ? "You" : "Sarjy"}</small>
      <span>{text}</span>
    </p>
  );
}
