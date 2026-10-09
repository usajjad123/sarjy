"use client";

import { BotAvatar, type BotAvatarState } from "bot-avatars";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { memo } from "react";

type Props = { speaker: "user" | "assistant"; level: MotionValue<number>; speaking: boolean; connected: boolean; microphone: boolean; thinking: boolean; subtitle?: string };

// Transcript and meter updates must not redraw the character's simulation.
const AvatarCharacter = memo(function AvatarCharacter({ assistant, state, paused }: { assistant: boolean; state: BotAvatarState; paused: boolean }) {
  return <BotAvatar type={assistant ? "clover" : "blob"} color={assistant ? "#b5e37b" : "#f3ac85"} face="mouth" shading="fabric" size="100%" state={state} paused={paused} interactive={false} headphones={!assistant} seed={assistant ? 0.27 : 0.68} jumpEvery={0} speed={0.7} turn={0.45} theme="light" />;
});

function AudioBar({ level, index, reduced }: { level: MotionValue<number>; index: number; reduced: boolean }) {
  const scaleY = useTransform(level, (value) => reduced ? 1 : 1 + value * (2 + 3 * Math.sin((index + 1) * 1.8) ** 2));
  return <motion.span className="voice-bar" style={{ scaleY }} />;
}

export function VoiceParticipant({ speaker, level, speaking, connected, microphone, thinking, subtitle }: Props) {
  const reduced = useReducedMotion();
  const smoothed = useSpring(level, { stiffness: 180, damping: 30 });
  const amplitude = useTransform(smoothed, (value) => Math.min(1, Math.max(0, value)));
  const scale = useTransform(amplitude, (value) => reduced ? 1 : 1 + value * 0.045);
  const ringScale = useTransform(amplitude, (value) => reduced ? 1 : 1 + value * 0.18);
  const ringOpacity = useTransform(amplitude, (value) => 0.12 + value * 0.5);
  const rotation = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (thinking && speaker === "assistant" && !reduced) rotation.set((rotation.get() + Math.min(delta, 64) * 0.045) % 360);
  });
  const active = connected && speaking;
  const isAssistant = speaker === "assistant";
  const status = !connected ? (isAssistant ? "Ready when you are" : "Microphone off")
    : active ? (isAssistant ? "Speaking" : "You’re speaking")
    : isAssistant ? (thinking ? "Thinking it through" : "Listening to you")
    : microphone ? "Your mic is on" : "Microphone muted";

  return <div className={`voice-participant ${isAssistant ? "assistant" : "user"}`} data-speaking={active}>
    <div className="avatar-stage" aria-hidden="true">
      <motion.div className="avatar-halo" style={{ scale: ringScale, opacity: ringOpacity }} />
      <motion.div className="avatar-orbit" style={{ rotate: rotation }} />
      <motion.div className="avatar-body" style={{ scale }}>
        <AvatarCharacter assistant={isAssistant} state={!connected ? "sleeping" : active || (thinking && isAssistant) ? "working" : "default"} paused={!!reduced} />
      </motion.div>
    </div>
    <div className="voice-wave" aria-hidden="true">{Array.from({ length: 11 }, (_, index) => <AudioBar key={index} level={amplitude} index={index} reduced={!!reduced} />)}</div>
    <h2>{isAssistant ? "Sarjy" : "You"}<span>{isAssistant ? subtitle || "AI companion" : "Just be yourself"}</span></h2>
    <p className="participant-status" role="status"><span className={active ? "status-dot active" : "status-dot"} />{status}</p>
  </div>;
}
