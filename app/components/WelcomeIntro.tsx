"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "../game/sfx";
import { gameStore, WELCOME_GIFT } from "../game/store";

interface Scene {
  text: string;
  /** ms to wait after the text finishes before moving to the next scene. */
  hold: number;
  /** The last scene: show the "claim gift" button instead of auto-advancing. */
  final?: boolean;
}

const GIFT = `$${WELCOME_GIFT.toLocaleString()}`;

/** Deliberate beat between pages. */
const PAUSE = 2500;

// Line breaks are hand-set so every line stays inside the book's pages.
const SCENES: Scene[] = [
  {
    text: "Welcome to drugcraft, i know\nyou are new here and don't\nknow much, im your drug\nexpert Chikkie",
    hold: PAUSE,
  },
  {
    text: "We will be growing some fun\nstuff together, it can be\ncannabis, shrooms, crack...\nOr maybe engineering hard\nstuff like Fent or Meth",
    hold: PAUSE,
  },
  {
    text: "Sounds interesting right?\nI know you are not familiar\nwith it yet, i will be here to\nguide you throughout your\njourney",
    hold: PAUSE,
  },
  {
    text: "Here i will put a welcome\ngift for joining, lets start\nthe journey here",
    hold: 0,
    final: true,
  },
];

export default function WelcomeIntro() {
  // -1 while the book slides up; then 0..SCENES.length-1.
  const [sceneIdx, setSceneIdx] = useState(-1);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide-up, then begin writing the first page.
  useEffect(() => {
    sfx.play("unlock");
    const t = setTimeout(() => setSceneIdx(0), 820);
    return () => clearTimeout(t);
  }, []);

  // Type the current scene out, character by character.
  useEffect(() => {
    if (sceneIdx < 0) return;
    const scene = SCENES[sceneIdx];
    setShown(0);
    setDone(false);
    let i = 0;
    const step = () => {
      i++;
      setShown(i);
      if (i >= scene.text.length) {
        if (scene.final) {
          setDone(true);
        } else {
          holdTimer.current = setTimeout(
            () => setSceneIdx((s) => s + 1),
            scene.hold,
          );
        }
        return;
      }
      const ch = scene.text[i - 1];
      const delay = ch === "\n" ? 230 : ".?…,".includes(ch) ? 150 : 30;
      typeTimer.current = setTimeout(step, delay);
    };
    typeTimer.current = setTimeout(step, 240);
    return () => {
      if (typeTimer.current) clearTimeout(typeTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, [sceneIdx]);

  // Tap anywhere to hurry: finish the line, or jump to the next page.
  const onSkip = () => {
    if (sceneIdx < 0 || leaving) return;
    const scene = SCENES[sceneIdx];
    if (typeTimer.current) clearTimeout(typeTimer.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (shown < scene.text.length) {
      setShown(scene.text.length);
      if (scene.final) setDone(true);
      else holdTimer.current = setTimeout(() => setSceneIdx((s) => s + 1), scene.hold);
    } else if (!scene.final) {
      setSceneIdx((s) => s + 1);
    }
  };

  const claim = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => gameStore.completeWelcome(), 320);
  };

  const scene = sceneIdx >= 0 ? SCENES[sceneIdx] : null;
  const text = scene ? scene.text.slice(0, shown) : "";
  const typing = !!scene && shown < scene.text.length;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden"
      style={{
        background: "rgba(8,18,12,0.45)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      onClick={onSkip}
    >
      {/* Pushed down so Chikkie's feet stay buried below the screen edge. */}
      <div
        style={{ width: "min(100%, 1080px)", transform: "translateY(13%)" }}
      >
        <div className={`${leaving ? "book-leave" : "book-rise"} book-wrap relative`}>
          <img
            src="/sprites/book.png"
            alt=""
            draggable={false}
            className="block h-auto w-full select-none"
          />
          {/* Handwriting stays fully inside the open pages. */}
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

      {/* Claim button / continue hint, pinned near the bottom of the screen. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center px-4">
        {done ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              claim();
            }}
            className="pointer-events-auto dc-pop rounded-xl bg-[#2fbf52] px-7 py-3.5 text-lg font-extrabold text-[#0a1f10] shadow-lg transition active:scale-95 hover:bg-[#3ad964]"
          >
            🎁 Claim {GIFT} & start
          </button>
        ) : (
          <span className="text-sm font-semibold text-[#9db8a5]">
            tap to continue
          </span>
        )}
      </div>
    </div>
  );
}
