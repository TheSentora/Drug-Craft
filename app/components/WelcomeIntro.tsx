"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../game/sfx";
import { WelcomeReward, gameStore } from "../game/store";

// ---- Chikkie's script -------------------------------------------------------

/** Beat between pages. */
const PAUSE = 2500;

// Line breaks are hand-set so every line stays inside the book's pages.
const SCENES: string[] = [
  "Welcome to drugcraft, i know\nyou are new here and don't\nknow much, im your drug\nexpert Chikkie",
  "We will be growing some fun\nstuff together, it can be\ncannabis, shrooms, crack...\nOr maybe engineering hard\nstuff like Fent or Meth",
  "Sounds interesting right?\nI know you are not familiar\nwith it yet, i will be here to\nguide you throughout your\njourney",
  "Here i will put a welcome\ngift for joining, lets start\nthe journey here",
];

// ---- Chest loot -------------------------------------------------------------

interface Loot {
  name: string;
  img: string;
  qty: number;
  weight: number;
  /** Card underline colour (rarity accent). */
  accent: string;
  reward: WelcomeReward;
}

// 80% cannabis seeds, 15% poppy seeds, 5% spread across the rest.
const LOOT: Loot[] = [
  { name: "Cannabis Seeds", img: "/sprites/cannabisseeds.png", qty: 1, weight: 20, accent: "#4caf50", reward: { kind: "seeds", crop: "cannabis", qty: 1, label: "Cannabis Seeds" } },
  { name: "Cannabis Seeds", img: "/sprites/cannabisseeds.png", qty: 3, weight: 25, accent: "#4caf50", reward: { kind: "seeds", crop: "cannabis", qty: 3, label: "Cannabis Seeds" } },
  { name: "Cannabis Seeds", img: "/sprites/cannabisseeds.png", qty: 5, weight: 20, accent: "#4caf50", reward: { kind: "seeds", crop: "cannabis", qty: 5, label: "Cannabis Seeds" } },
  { name: "Cannabis Seeds", img: "/sprites/cannabisseeds.png", qty: 10, weight: 15, accent: "#4caf50", reward: { kind: "seeds", crop: "cannabis", qty: 10, label: "Cannabis Seeds" } },
  { name: "Poppy Seeds", img: "/sprites/poppyseeds.png", qty: 1, weight: 9, accent: "#e0577f", reward: { kind: "seeds", crop: "poppy", qty: 1, label: "Poppy Seeds" } },
  { name: "Poppy Seeds", img: "/sprites/poppyseeds.png", qty: 5, weight: 6, accent: "#e0577f", reward: { kind: "seeds", crop: "poppy", qty: 5, label: "Poppy Seeds" } },
  { name: "Sulfuric Acid", img: "/sprites/sulfuric_acid.png", qty: 10, weight: 2, accent: "#f0b23a", reward: { kind: "product", id: "sulfuric_acid", qty: 10, label: "Sulfuric Acid" } },
  { name: "Gasoline", img: "/sprites/gasoline.png", qty: 10, weight: 2, accent: "#f0b23a", reward: { kind: "product", id: "gasoline", qty: 10, label: "Gasoline" } },
  { name: "Cocaine", img: "/sprites/cocaine.png", qty: 1, weight: 1, accent: "#e04a3c", reward: { kind: "product", id: "cocaine", qty: 1, label: "Cocaine" } },
];

function rollLoot(): Loot {
  const total = LOOT.reduce((s, l) => s + l.weight, 0);
  let r = Math.random() * total;
  for (const l of LOOT) {
    r -= l.weight;
    if (r <= 0) return l;
  }
  return LOOT[0];
}

// ---- Spinner geometry -------------------------------------------------------

const CARD_W = 148; // px
const CARD_GAP = 10; // px
const STEP = CARD_W + CARD_GAP;
const STRIP_LEN = 96;
const WIN_INDEX = 84; // where the winning card sits in the strip
const SPIN_MS = 9000;

type Phase = "book" | "gift" | "spin";

export default function WelcomeIntro() {
  const [phase, setPhase] = useState<Phase>("book");

  // -- book phase --
  const [sceneIdx, setSceneIdx] = useState(-1);
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // -- spin phase --
  const winner = useMemo(() => rollLoot(), []);
  const strip = useMemo(() => {
    const cards: Loot[] = Array.from({ length: STRIP_LEN }, () => rollLoot());
    cards[WIN_INDEX] = winner;
    return cards;
  }, [winner]);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const laneRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Book slides up, then the writing starts.
  useEffect(() => {
    sfx.play("unlock");
    later(() => setSceneIdx(0), 820);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // Type the current scene out, character by character. No skipping.
  useEffect(() => {
    if (phase !== "book" || sceneIdx < 0) return;
    const text = SCENES[sceneIdx];
    setShown(0);
    let i = 0;
    let alive = true;
    const step = () => {
      if (!alive) return;
      i++;
      setShown(i);
      const ch = text[i - 1];
      if (ch !== "\n" && ch !== " ") sfx.play("type");
      if (i >= text.length) {
        // Page done → pause, then next page or the chicken sinks away.
        later(() => {
          if (sceneIdx < SCENES.length - 1) {
            setSceneIdx((s) => s + 1);
          } else {
            setLeaving(true);
            later(() => setPhase("gift"), 420);
          }
        }, PAUSE);
        return;
      }
      later(step, ch === "\n" ? 230 : ".?…,".includes(ch) ? 150 : 30);
    };
    later(step, 240);
    return () => {
      alive = false;
    };
  }, [phase, sceneIdx]);

  // Gift popup fanfare.
  useEffect(() => {
    if (phase === "gift") sfx.play("order");
  }, [phase]);

  const unlock = () => {
    if (spinning) return;
    const lane = laneRef.current;
    const track = trackRef.current;
    if (!lane || !track) return;
    const laneW = lane.clientWidth;
    // Land the winning card under the centre marker (with a little jitter).
    const jitter = (Math.random() - 0.5) * CARD_W * 0.6;
    const target = WIN_INDEX * STEP + CARD_W / 2 - laneW / 2 + jitter;
    setSpinning(true);
    sfx.play("unlock");
    // Frame-driven spin: blazing start, stays fast, long wind-down at the end.
    const t0 = performance.now();
    let lastIdx = -1;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / SPIN_MS);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic keeps speed up
      const x = -target * eased;
      track.style.transform = `translateX(${x}px)`;
      // Clack every time a card crosses the centre marker.
      const centerIdx = Math.floor((target * eased + laneW / 2) / STEP);
      if (centerIdx !== lastIdx) {
        lastIdx = centerIdx;
        sfx.play("tick");
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setLanded(true);
        sfx.play("levelup");
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const collect = () => {
    gameStore.completeWelcome(winner.reward);
  };

  const text = sceneIdx >= 0 ? SCENES[sceneIdx].slice(0, shown) : "";
  const typing = sceneIdx >= 0 && shown < SCENES[sceneIdx].length;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden"
      style={{
        background: "rgba(8,18,12,0.45)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* ---- Phase 1: Chikkie writes in the book ---- */}
      {phase === "book" && (
        <div style={{ width: "min(100%, 1080px)", transform: "translateY(13%)" }}>
          <div className={`${leaving ? "book-leave" : "book-rise"} book-wrap relative`}>
            <img
              src="/sprites/book.png"
              alt=""
              draggable={false}
              className="block h-auto w-full select-none"
            />
            <div
              className="absolute flex items-center justify-center"
              style={{ left: "10%", top: "12%", width: "52%", height: "58%" }}
            >
              <p className="book-text">
                {text}
                {typing && <span className="ink-caret" />}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Phase 2: the gift popup ---- */}
      {phase === "gift" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="dc-pop w-full max-w-xl rounded-2xl border border-[#2a4133] bg-[#101a13] p-6 text-center shadow-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Welcome Gift from Chikkie
            </h1>
            <img
              src="/sprites/welcome.png"
              alt=""
              draggable={false}
              className="mx-auto my-3 h-auto w-[min(52vh,320px)] select-none"
            />
            <button
              onClick={() => setPhase("spin")}
              className="w-full rounded-xl bg-[#2fbf52] px-6 py-3.5 text-lg font-extrabold text-[#0a1f10] transition active:scale-[0.98] hover:bg-[#3ad964]"
            >
              Accept
            </button>
            {/* Preload the spinner art while the player reads. */}
            <div className="hidden">
              {LOOT.map((l) => (
                <img key={l.img + l.qty} src={l.img} alt="" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Phase 3: the case spinner ---- */}
      {phase === "spin" && (
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <div className="dc-pop w-[min(97vw,1360px)] rounded-2xl border border-[#2a4133] bg-[#101a13] p-4 shadow-2xl sm:p-6">
            <h2 className="mb-3 text-center text-2xl font-extrabold text-white sm:text-3xl">
              {landed ? (
                <>
                  You got{" "}
                  <span style={{ color: winner.accent }}>
                    {winner.qty}× {winner.name}
                  </span>
                  !
                </>
              ) : (
                "Chikkie's Chest"
              )}
            </h2>

            {/* Lane */}
            <div
              ref={laneRef}
              className="relative overflow-hidden rounded-xl border border-[#243b2c] bg-[#0b140e] py-4"
            >
              {/* centre marker */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[4px] -translate-x-1/2 bg-[#f0b23a]" />
              <div
                ref={trackRef}
                className="flex"
                style={{ gap: `${CARD_GAP}px`, willChange: "transform" }}
              >
                {strip.map((l, i) => (
                  <div
                    key={i}
                    className={`flex shrink-0 flex-col items-center rounded-lg border p-3 ${
                      landed && i === WIN_INDEX
                        ? "border-[#4ade80] bg-[#123021]"
                        : "border-[#243b2c] bg-[#101a13]"
                    }`}
                    style={{ width: `${CARD_W}px` }}
                  >
                    <img
                      src={l.img}
                      alt=""
                      draggable={false}
                      className="h-24 w-24 select-none object-contain"
                    />
                    <span className="mt-1 text-base font-extrabold text-white">×{l.qty}</span>
                    <span className="w-full truncate text-center text-[11px] font-semibold text-[#9db8a5]">
                      {l.name}
                    </span>
                    <span
                      className="mt-1.5 h-[4px] w-full rounded-full"
                      style={{ background: l.accent }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              {landed ? (
                <button
                  onClick={collect}
                  className="dc-pop rounded-xl bg-[#2fbf52] px-8 py-3 text-lg font-extrabold text-[#0a1f10] transition active:scale-95 hover:bg-[#3ad964]"
                >
                  Collect
                </button>
              ) : (
                <button
                  onClick={unlock}
                  disabled={spinning}
                  className="rounded-xl bg-[#f0b23a] px-8 py-3 text-lg font-extrabold text-[#1a1204] transition active:scale-95 enabled:hover:bg-[#ffc74e] disabled:opacity-50"
                >
                  {spinning ? "…" : "Unlock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
