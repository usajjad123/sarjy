"use client";

import { BotAvatar, type BotAvatarState } from "bot-avatars";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { memo } from "react";

import styles from "./sarjy-avatar.module.css";

type Props = {
  level: MotionValue<number>;
  speaking: boolean;
  connected: boolean;
  thinking: boolean;
};

// Transcript and meter updates must not redraw the character's simulation.
const AvatarCharacter = memo(function AvatarCharacter({
  state,
  paused,
}: {
  state: BotAvatarState;
  paused: boolean;
}) {
  return (
    <BotAvatar
      type="clover"
      color="#b5e37b"
      face="mouth"
      shading="fabric"
      size="100%"
      state={state}
      paused={paused}
      interactive={false}
      seed={0.27}
      jumpEvery={0}
      speed={0.7}
      turn={0.45}
      theme="light"
    />
  );
});

function AudioBar({
  level,
  index,
  reduced,
}: {
  level: MotionValue<number>;
  index: number;
  reduced: boolean;
}) {
  const scaleY = useTransform(level, (value) =>
    reduced ? 1 : 1 + value * (2 + 3 * Math.sin((index + 1) * 1.8) ** 2),
  );
  return <motion.span className={styles.bar} style={{ scaleY }} />;
}

export function SarjyAvatar({ level, speaking, connected, thinking }: Props) {
  const reduced = useReducedMotion();
  const smoothed = useSpring(level, { stiffness: 180, damping: 30 });
  const amplitude = useTransform(smoothed, (value) => Math.min(1, Math.max(0, value)));
  const scale = useTransform(amplitude, (value) => (reduced ? 1 : 1 + value * 0.045));
  const ringScale = useTransform(amplitude, (value) => (reduced ? 1 : 1 + value * 0.18));
  const ringOpacity = useTransform(amplitude, (value) => 0.12 + value * 0.5);
  const rotation = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (thinking && !reduced) rotation.set((rotation.get() + Math.min(delta, 64) * 0.045) % 360);
  });
  const active = connected && speaking;

  return (
    <motion.div
      layout={reduced ? false : "position"}
      className={styles.avatar}
      data-speaking={active}
    >
      <motion.div layout={!reduced} className={styles.stage} aria-hidden="true">
        <motion.div className={styles.halo} style={{ scale: ringScale, opacity: ringOpacity }} />
        <motion.div className={styles.orbit} style={{ rotate: rotation }} />
        <motion.div className={styles.body} style={{ scale }}>
          <AvatarCharacter
            state={!connected ? "sleeping" : active || thinking ? "working" : "default"}
            paused={!!reduced}
          />
        </motion.div>
      </motion.div>
      <div className={styles.wave} aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => (
          <AudioBar key={index} level={amplitude} index={index} reduced={!!reduced} />
        ))}
      </div>
      <h2 className={styles.name}>Sarjy</h2>
    </motion.div>
  );
}
