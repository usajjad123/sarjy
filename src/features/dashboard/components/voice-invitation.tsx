import type { SarjyVoice } from "../types";
import { Icon } from "./icon";

export function VoiceInvitation({ voice }: { voice: SarjyVoice }) {
  return (
    <section className="voice-invitation">
      <div className="invitation-art" aria-hidden="true">
        <span>✳</span>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div>
        <p className="fit-eyebrow">NO SEARCH. NO SPREADSHEETS.</p>
        <h2>Just say what you ate.</h2>
        <p>“200 grams of cooked chicken and 150 grams of cooked rice.”</p>
      </div>
      <button
        className="primary"
        disabled={voice.state === "connecting" || voice.micBusy}
        onClick={() =>
          voice.connected
            ? document.getElementById("companion")?.scrollIntoView({ behavior: "smooth" })
            : voice.start(true)
        }
      >
        <Icon name="mic" />
        {voice.connected ? "Keep talking" : "Talk to Sarjy"}
      </button>
    </section>
  );
}
