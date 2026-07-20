/**
 * useAudioFX — Web Audio API synthesizer hook
 *
 * Generates all sound effects programmatically using the browser's native
 * AudioContext. Zero external assets, zero network requests, zero latency.
 *
 * Four synthesized sound profiles:
 *   keyclick   — short filtered noise burst (10–15ms) on each keypress
 *   receive    — dual-frequency sine chirp on incoming message
 *   transmit   — slightly higher dual-tone chirp on outgoing message send
 *   handshake  — ascending pitch sweep when peer comes online
 *   bossAlarm  — descending alarm chirp on Escape / boss mode trigger
 *
 * AudioContext is lazily initialized on first call (browser policy requires
 * a user gesture before audio is allowed). All methods are no-ops when muted.
 */

import { useRef, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ref.current) {
    try {
      ref.current = new AudioContext();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser policy)
  if (ref.current.state === "suspended") {
    ref.current.resume();
  }
  return ref.current;
}

/** Ramp a param from current value to target over duration (seconds) */
function rampTo(
  param: AudioParam,
  target: number,
  duration: number,
  ctx: AudioContext,
) {
  param.setValueAtTime(param.value, ctx.currentTime);
  param.linearRampToValueAtTime(target, ctx.currentTime + duration);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAudioFX(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  // ── keyclick: filtered noise burst (mechanical key switch feel) ────────────
  const playKeyclick = useCallback(() => {
    if (muted) return;
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.012; // 12ms of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // fade out
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Low-pass filter strips the hiss — keeps only the thump
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.018);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.018);
  }, [muted]);

  // ── receive: dual-frequency sine chirp (incoming packet) ──────────────────
  const playReceive = useCallback(() => {
    if (muted) return;
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    gain.connect(ctx.destination);

    // First tone
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.15);
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);

    // Second tone — slightly offset for the "chirp" texture
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.04);
    osc2.frequency.linearRampToValueAtTime(820, ctx.currentTime + 0.18);
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.04);
    osc2.stop(ctx.currentTime + 0.18);
  }, [muted]);

  // ── transmit: slightly higher chirp (outgoing send confirmation) ───────────
  const playTransmit = useCallback(() => {
    if (muted) return;
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1100, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.12);
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.14);

    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.03);
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.03);
    osc2.stop(ctx.currentTime + 0.14);
  }, [muted]);

  // ── handshake: ascending pitch sweep (peer comes online) ──────────────────
  const playHandshake = useCallback(() => {
    if (muted) return;
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    gain.connect(ctx.destination);

    // Main sweep oscillator — dial-up / CRT power-on vibe
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.35);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.55);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.58);

    // Sub-tone for body
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(220, ctx.currentTime);
    rampTo(osc2.frequency, 440, 0.5, ctx);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.12, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.52);
  }, [muted]);

  // ── bossAlarm: descending alarm chirp (Escape / boss mode trigger) ─────────
  const playBossAlarm = useCallback(() => {
    if (muted) return;
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    // Two rapid descending pulses for the "alert" feel
    const playPulse = (startTime: number) => {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, startTime);
      osc.frequency.exponentialRampToValueAtTime(220, startTime + 0.14);
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + 0.16);
    };

    playPulse(ctx.currentTime);
    playPulse(ctx.currentTime + 0.18);
  }, [muted]);

  return {
    playKeyclick,
    playReceive,
    playTransmit,
    playHandshake,
    playBossAlarm,
  };
}
