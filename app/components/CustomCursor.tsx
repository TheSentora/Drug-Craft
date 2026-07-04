"use client";

import { useEffect, useRef } from "react";

/** On-screen size of the cursor (px). Height scales from the source ratio. */
const CURSOR_W = 82;
const RATIO = 1225 / 920;
const CURSOR_H = CURSOR_W * RATIO;
// Fingertip position within the image (the active "hotspot").
const HOTSPOT_X = 0.54;
const HOTSPOT_Y = 0.015;

/**
 * Replaces the native mouse pointer with an oversized mouse.png that follows
 * the cursor. Only activates for fine (mouse) pointers, so touch is untouched.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    const move = (e: PointerEvent) => {
      el.style.opacity = "1";
      el.style.transform = `translate3d(${
        e.clientX - CURSOR_W * HOTSPOT_X
      }px, ${e.clientY - CURSOR_H * HOTSPOT_Y}px, 0)`;
    };
    const hide = () => {
      el.style.opacity = "0";
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <img
      ref={ref}
      src="/sprites/mouse.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: CURSOR_W,
        height: "auto",
        opacity: 0,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 2147483647,
      }}
    />
  );
}
