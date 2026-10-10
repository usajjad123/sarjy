import type { SarjyVoice } from "../types";
import { Icon } from "./icon";

export function MobileVoiceControls({
  voice,
  ready,
  onOpen,
}: {
  voice: SarjyVoice;
  ready: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="mobile-companion-bar">
      <button
        aria-label="Open Sarjy voice conversation"
        disabled={!ready || voice.state === "connecting" || voice.micBusy}
        onClick={onOpen}
      >
        <span className="mobile-sarjy-mark">✳</span>
        <span>
          <strong>Sarjy</strong>
          <small>
            {voice.state === "connecting"
              ? "Connecting…"
              : voice.tool
                ? "Updating your records"
                : voice.speaking.assistant
                  ? "Speaking"
                  : voice.speaking.user
                    ? "You’re speaking"
                    : voice.connected
                      ? "Conversation open"
                      : "Tell me what you ate"}
          </small>
        </span>
        <Icon name="mic" />
      </button>
      {voice.connected && (
        <button
          className="mobile-mic"
          aria-label={voice.mic ? "Mute microphone" : "Enable microphone"}
          disabled={voice.micBusy}
          onClick={voice.toggleMic}
        >
          {voice.mic ? "Mute" : "Mic off"}
        </button>
      )}
    </div>
  );
}
