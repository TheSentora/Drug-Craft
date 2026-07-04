"use client";

/**
 * Tiny WebAudio synth for game feedback sounds — no audio files needed.
 * The AudioContext is created lazily on the first user-triggered sound so
 * browsers' autoplay policies are satisfied. Mute preference persists.
 */
const MUTE_KEY = "drugcraft:muted";

let ctx: AudioContext | null = null;
let muted = false;
let mutedLoaded = false;

function ensureMutedLoaded() {
  if (mutedLoaded || typeof window === "undefined") return;
  mutedLoaded = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  delay = 0,
  type: OscillatorType = "sine",
  vol = 0.13,
  slideTo?: number,
) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/** Short filtered white-noise burst — hard mechanical clicks/clacks. */
function noise(
  dur: number,
  delay: number,
  vol: number,
  filterFreq: number,
  filterType: BiquadFilterType = "highpass",
) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const len = Math.max(1, (dur * a.sampleRate) | 0);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export type SfxName =
  | "plant"
  | "harvest"
  | "sell"
  | "order"
  | "levelup"
  | "unlock"
  | "error"
  | "type"
  | "tick";

export const sfx = {
  isMuted(): boolean {
    ensureMutedLoaded();
    return muted;
  },
  setMuted(m: boolean) {
    ensureMutedLoaded();
    muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {}
  },
  toggle(): boolean {
    this.setMuted(!this.isMuted());
    return muted;
  },
  play(name: SfxName) {
    ensureMutedLoaded();
    if (muted) return;
    switch (name) {
      case "plant":
        tone(240, 0.09, 0, "sine", 0.12, 390);
        break;
      case "harvest":
        tone(523, 0.07, 0, "triangle", 0.14);
        tone(784, 0.09, 0.06, "triangle", 0.12);
        break;
      case "sell":
        tone(880, 0.08, 0, "sine", 0.12);
        tone(1318, 0.1, 0.07, "sine", 0.1);
        break;
      case "order":
        tone(523, 0.12, 0, "triangle", 0.12);
        tone(659, 0.12, 0.08, "triangle", 0.12);
        tone(784, 0.18, 0.16, "triangle", 0.12);
        break;
      case "levelup":
        [523, 659, 784, 1046].forEach((f, i) =>
          tone(f, 0.15, i * 0.09, "triangle", 0.13),
        );
        break;
      case "unlock":
        tone(150, 0.16, 0, "sine", 0.16, 95);
        tone(392, 0.12, 0.12, "triangle", 0.1);
        break;
      case "error":
        tone(150, 0.11, 0, "square", 0.045);
        break;
      case "type":
        // Hard typewriter clack for the handwriting intro.
        noise(0.024, 0, 0.22, 2400, "highpass");
        tone(190, 0.028, 0, "square", 0.07);
        break;
      case "tick":
        // Hard mechanical clack as spinner cards pass the marker.
        noise(0.02, 0, 0.28, 1600, "highpass");
        tone(300, 0.04, 0, "square", 0.11);
        break;
    }
  },
};
