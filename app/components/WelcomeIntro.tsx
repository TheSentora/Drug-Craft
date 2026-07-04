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

const SCENES: Scene[] = [
  {
    text: "Welcome to DrugCraft.\nI know you're new here and don't\nknow much — I'm your drug\nexpert, Chikkie.",
    hold: 1000,
  },
  {
    text: "We'll be growing some fun stuff\ntogether — cannabis, shrooms,\ncrack…\nOr maybe engineering the hard\nstuff, like Fent or Meth.",
    hold: 1000,
  },
  {
    text: "Sounds interesting, right?\nYou're not familiar with it yet,\nbut I'll be here to guide you\nthe whole way.",
    hold: 700,
  },
  {
    text: `Here's a welcome gift of ${GIFT}\nfor joining.\nLet's start the journey.`,
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
    const t = setTimeout(() => setSceneIdx(0), 780);
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
    typeTimer.current = setTimeout(step, 220);
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
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-3"
      style={{ background: "rgba(6,14,10,0.9)" }}
      onClick={onSkip}
    >
      <div
        className={leaving ? "book-leave" : "book-rise"}
        style={{ width: "min(96vw, 780px)" }}
      >
        <div className="book-wrap relative">
          <img
            src="/sprites/book.png"
            alt=""
            draggable={false}
            className="block h-auto w-full select-none"
          />
          {/* Handwriting sits over the open pages of the book. */}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: "8.5%", top: "10%", width: "55%", height: "64%" }}
          >
            <p className="book-text">
              {text}
              {typing && <span className="ink-caret" />}
            </p>
          </div>
        </div>

        {/* Claim button (final page) or a subtle continue hint. */}
        <div className="mt-3 flex h-12 items-center justify-center">
          {done ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                claim();
              }}
              className="dc-pop rounded-xl bg-[#2fbf52] px-6 py-3 text-base font-extrabold text-[#0a1f10] shadow-lg transition active:scale-95 hover:bg-[#3ad964]"
            >
              🎁 Claim {GIFT} & start
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#7f9c88]">
              tap to continue
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
