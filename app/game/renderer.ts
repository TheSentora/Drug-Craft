"use client";

import { CROPS } from "./crops";
import { cropSpriteUrl } from "./sprites";
import { gameStore, isReady, plantProgress, plotPrice } from "./store";
import { CropId } from "./types";
import {
  Camera,
  CHICKEN_ZONE,
  DECOR,
  Decor,
  FIELD_CENTER,
  FenceSeg,
  ISLAND_MAX_X,
  ISLAND_MAX_Y,
  ISLAND_MIN_X,
  ISLAND_MIN_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_H,
  TILE_THICK,
  TILE_W,
  WORLD_PAN,
  farmDistance,
  fenceSegments,
  isFieldTile,
  isPath,
  isPond,
  panDelta,
  plotIndexAt,
  plotTile,
  screenToTile,
  tileToScreen,
} from "./world";

const EMOJI_FONT =
  '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
const UI_FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

/** Deterministic per-tile hash for texture variation. */
function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ ((x + 91) * (y + 47) * 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/** Small deterministic RNG for baked textures. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Optional per-crop artwork (SVG icons). Loaded lazily + cached.
interface CropSprite {
  img: HTMLImageElement;
  frames: number;
  ok: boolean;
}
const cropSprites = new Map<CropId, CropSprite>();
function getCropSprite(id: CropId): CropSprite | null {
  if (typeof window === "undefined") return null;
  let entry = cropSprites.get(id);
  if (!entry) {
    const img = new Image();
    entry = { img, frames: 1, ok: false };
    const e = entry;
    img.onload = () => {
      e.frames = Math.max(1, Math.round(img.naturalWidth / img.naturalHeight));
      e.ok = true;
    };
    img.src = cropSpriteUrl(id);
    cropSprites.set(id, entry);
  }
  return entry;
}

type TileKind = "grassA" | "grassB" | "soilA" | "soilB" | "path" | "water";
const SPR_SCALE = 3;

interface SceneObject {
  depth: number;
  x: number;
  y: number;
  kind: "crop" | "fence" | "chicken" | Decor["type"];
  plotIndex?: number;
  fence?: FenceSeg;
  chicken?: Chicken;
}

interface Chicken {
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: "idle" | "walk";
  until: number;
  dir: 1 | -1;
  phase: number;
}

interface Butterfly {
  cx: number;
  cy: number;
  r: number;
  speed: number;
  phase: number;
  color: string;
}

interface Particle {
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  rise: number;
  age: number;
  life: number;
  size: number;
  color: string;
  text?: string;
}

interface Cloud {
  x: number; // screen-fraction position
  y: number;
  scale: number;
  vx: number;
}

/**
 * Renders the isometric farm island: textured ground, animated water and
 * clouds, decorated world (fences, windmill, animals) and effect particles.
 * Also maps pointer interaction (pan / zoom / tap-a-plot) to the game store.
 */
export class FarmRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onTileClick: (index: number) => void;
  private raf = 0;
  private cssW = 0;
  private cssH = 0;
  private viewW = 0;
  private viewH = 0;
  private userAdjusted = false;
  private ro: ResizeObserver | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  private cam: Camera = { lookX: FIELD_CENTER.x, lookY: FIELD_CENTER.y, zoom: 1 };
  private fences: FenceSeg[] = fenceSegments();
  private tileSprites = new Map<TileKind, HTMLCanvasElement>();

  private chickens: Chicken[] = [];
  private butterflies: Butterfly[] = [];
  private particles: Particle[] = [];
  private clouds: Cloud[] = [
    { x: 0.15, y: 0.2, scale: 1.3, vx: 0.006 },
    { x: 0.6, y: 0.55, scale: 1.8, vx: 0.004 },
    { x: 0.9, y: 0.1, scale: 1.0, vx: 0.008 },
  ];
  private lastT = 0;

  // Pointer / drag state.
  private down = false;
  private moved = false;
  private startSX = 0;
  private startSY = 0;
  private startLookX = 0;
  private startLookY = 0;
  private startZoom = 1;
  private hover = { x: NaN, y: NaN };

  constructor(canvas: HTMLCanvasElement, onTileClick: (index: number) => void) {
    this.canvas = canvas;
    this.onTileClick = onTileClick;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    // Chickens.
    for (let i = 0; i < 3; i++) {
      const x = CHICKEN_ZONE.minX + Math.random() * (CHICKEN_ZONE.maxX - CHICKEN_ZONE.minX);
      const y = CHICKEN_ZONE.minY + Math.random() * (CHICKEN_ZONE.maxY - CHICKEN_ZONE.minY);
      this.chickens.push({
        x,
        y,
        tx: x,
        ty: y,
        state: "idle",
        until: performance.now() + 500 + Math.random() * 2000,
        dir: Math.random() < 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // Butterflies over the field.
    const colors = ["#f6c445", "#e88ac2", "#9ad7f0"];
    for (let i = 0; i < 3; i++) {
      this.butterflies.push({
        cx: FIELD_CENTER.x - 1 + Math.random() * 2,
        cy: FIELD_CENTER.y - 1 + Math.random() * 2,
        r: 1.2 + Math.random() * 1.6,
        speed: 0.25 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
      });
    }

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.loop = this.loop.bind(this);

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
  }

  start() {
    this.resize();
    this.lastT = performance.now();
    // Run the first tick directly — rAF never fires in hidden tabs, and the
    // loop schedules its own next tick (rAF when visible, timer when hidden).
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.ro?.disconnect();
  }

  // ---- Public controls (HUD buttons) -------------------------------------

  recenter() {
    this.cam.lookX = FIELD_CENTER.x;
    this.cam.lookY = FIELD_CENTER.y;
    this.cam.zoom = this.fitZoom();
    this.userAdjusted = false;
  }

  zoomBy(factor: number) {
    this.cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.cam.zoom * factor));
    this.userAdjusted = true;
  }

  // ---- Sizing --------------------------------------------------------------

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const panel = this.cssW > 900 ? 330 : 0;
    this.viewW = this.cssW - panel;
    this.viewH = this.cssH + 40;

    if (!this.userAdjusted) this.recenter();
  }

  private fitZoom(): number {
    const spanX = ISLAND_MAX_X - ISLAND_MIN_Y - (ISLAND_MIN_X - ISLAND_MAX_Y);
    const spanY = ISLAND_MAX_X + ISLAND_MAX_Y - (ISLAND_MIN_X + ISLAND_MIN_Y);
    const worldW = spanX * (TILE_W / 2);
    const worldH = spanY * (TILE_H / 2);
    const fit = Math.min((this.viewW * 0.94) / worldW, (this.cssH * 0.8) / worldH);
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit));
  }

  // ---- Input ----------------------------------------------------------------

  private localPoint(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onDown(e: PointerEvent) {
    this.down = true;
    this.moved = false;
    const [x, y] = this.localPoint(e);
    this.startSX = x;
    this.startSY = y;
    this.startLookX = this.cam.lookX;
    this.startLookY = this.cam.lookY;
    this.startZoom = this.cam.zoom;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
  }

  private onMove(e: PointerEvent) {
    const [x, y] = this.localPoint(e);
    if (this.down) {
      const dx = x - this.startSX;
      const dy = y - this.startSY;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        this.moved = true;
        this.userAdjusted = true;
      }
      const d = panDelta(dx, dy, { ...this.cam, zoom: this.startZoom });
      this.cam.lookX = this.clampLook(
        this.startLookX + d.dLookX,
        ISLAND_MIN_X - WORLD_PAN,
        ISLAND_MAX_X + WORLD_PAN,
      );
      this.cam.lookY = this.clampLook(
        this.startLookY + d.dLookY,
        ISLAND_MIN_Y - WORLD_PAN,
        ISLAND_MAX_Y + WORLD_PAN,
      );
      this.canvas.style.cursor = "grabbing";
    } else {
      const t = screenToTile(x, y, this.cam, this.viewW, this.viewH);
      this.hover = { x: Math.round(t.x), y: Math.round(t.y) };
      const idx = plotIndexAt(this.hover.x, this.hover.y);
      this.canvas.style.cursor = idx >= 0 ? "pointer" : "grab";
    }
  }

  private onUp(e: PointerEvent) {
    if (!this.down) return;
    this.down = false;
    this.canvas.style.cursor = "grab";
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {}
    if (this.moved) return;
    const [x, y] = this.localPoint(e);
    const t = screenToTile(x, y, this.cam, this.viewW, this.viewH);
    const idx = plotIndexAt(Math.round(t.x), Math.round(t.y));
    if (idx >= 0) this.onTileClick(idx);
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  private clampLook(v: number, min: number, max: number): number {
    return Math.min(max + 1, Math.max(min - 1, v));
  }

  // ---- Baked tile textures ---------------------------------------------------

  private tileSprite(kind: TileKind): HTMLCanvasElement {
    let spr = this.tileSprites.get(kind);
    if (!spr) {
      spr = this.buildTileSprite(kind);
      this.tileSprites.set(kind, spr);
    }
    return spr;
  }

  private buildTileSprite(kind: TileKind): HTMLCanvasElement {
    const W = TILE_W * SPR_SCALE;
    const HT = TILE_H * SPR_SCALE;
    const TH = TILE_THICK * SPR_SCALE;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = HT + TH;
    const g = cv.getContext("2d")!;
    const seed = kind.charCodeAt(0) * 7919 + kind.length * 104729;
    const rnd = mulberry32(seed);

    const diamond = () => {
      g.beginPath();
      g.moveTo(W / 2, 0);
      g.lineTo(W, HT / 2);
      g.lineTo(W / 2, HT);
      g.lineTo(0, HT / 2);
      g.closePath();
    };

    let topA = "#57ad46";
    let topB = "#4c9c3c";
    let side = "#356f29";
    if (kind === "grassB") {
      topA = "#519f40";
      topB = "#468f37";
    } else if (kind === "soilA") {
      topA = "#8a5a3a";
      topB = "#79492c";
      side = "#5a3a25";
    } else if (kind === "soilB") {
      topA = "#815236";
      topB = "#704329";
      side = "#54371f";
    } else if (kind === "path") {
      topA = "#c9a76a";
      topB = "#b9945a";
      side = "#8a6c40";
    } else if (kind === "water") {
      topA = "#49a7da";
      topB = "#3a90c2";
      side = "#2c6f99";
    }

    // Side faces.
    g.fillStyle = side;
    g.beginPath();
    g.moveTo(0, HT / 2);
    g.lineTo(W / 2, HT);
    g.lineTo(W / 2, HT + TH);
    g.lineTo(0, HT / 2 + TH);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(W, HT / 2);
    g.lineTo(W / 2, HT);
    g.lineTo(W / 2, HT + TH);
    g.lineTo(W, HT / 2 + TH);
    g.closePath();
    g.fill();
    // subtle side shading
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.beginPath();
    g.moveTo(W, HT / 2);
    g.lineTo(W / 2, HT);
    g.lineTo(W / 2, HT + TH);
    g.lineTo(W, HT / 2 + TH);
    g.closePath();
    g.fill();

    // Top face with vertical gradient.
    const grad = g.createLinearGradient(0, 0, 0, HT);
    grad.addColorStop(0, topA);
    grad.addColorStop(1, topB);
    diamond();
    g.fillStyle = grad;
    g.fill();

    // Texture detail, clipped to the top face.
    g.save();
    diamond();
    g.clip();
    if (kind === "grassA" || kind === "grassB") {
      for (let i = 0; i < 130; i++) {
        const x = rnd() * W;
        const y = rnd() * HT;
        const l = 2 + rnd() * 4;
        g.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(0,60,0,0.14)";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 3, y - l);
        g.stroke();
      }
      for (let i = 0; i < 7; i++) {
        g.fillStyle = "rgba(255,255,220,0.10)";
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * HT, 6 + rnd() * 12, 3 + rnd() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "soilA" || kind === "soilB") {
      // Furrows along the iso axis.
      g.strokeStyle = "rgba(0,0,0,0.20)";
      g.lineWidth = 3;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(0, HT / 2 + k * (HT / 6));
        g.lineTo(W / 2, HT + k * (HT / 6));
        g.stroke();
      }
      g.strokeStyle = "rgba(255,220,180,0.08)";
      g.lineWidth = 1.6;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(0, HT / 2 + k * (HT / 6) - 2);
        g.lineTo(W / 2, HT + k * (HT / 6) - 2);
        g.stroke();
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)";
        g.beginPath();
        g.arc(rnd() * W, rnd() * HT, 1 + rnd() * 2, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "path") {
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(120,90,50,0.35)" : "rgba(255,255,255,0.12)";
        g.beginPath();
        g.ellipse(rnd() * W, rnd() * HT, 2 + rnd() * 4, 1.4 + rnd() * 2.4, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "water") {
      const glow = g.createRadialGradient(W / 2, HT / 2, 4, W / 2, HT / 2, W / 2);
      glow.addColorStop(0, "rgba(255,255,255,0.16)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = glow;
      diamond();
      g.fill();
    }
    // Ambient edge shading so tiles read as 3D.
    const edge = g.createLinearGradient(0, HT * 0.55, 0, HT);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,0.16)");
    diamond();
    g.fillStyle = edge;
    g.fill();
    g.restore();

    return cv;
  }

  private blitTile(kind: TileKind, sx: number, sy: number) {
    const z = this.cam.zoom;
    const hw = (TILE_W / 2) * z;
    const hh = (TILE_H / 2) * z;
    this.ctx.drawImage(
      this.tileSprite(kind),
      sx - hw,
      sy - hh,
      TILE_W * z,
      (TILE_H + TILE_THICK) * z,
    );
  }

  // ---- Render loop -----------------------------------------------------------

  private loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    // Recover from a zero-size initial layout (e.g. hidden tab at mount).
    if (this.cssW < 2 || this.cssH < 2) this.resize();
    this.update(now, dt);
    this.draw(now);
    // rAF is paused in hidden tabs; fall back to a slow timer there so the
    // world is already fresh the instant the tab becomes visible again.
    if (typeof document !== "undefined" && document.hidden) {
      this.hiddenTimer = setTimeout(this.loop, 250);
    } else {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private update(now: number, dt: number) {
    // Chickens wander.
    for (const c of this.chickens) {
      if (now >= c.until) {
        if (c.state === "idle") {
          c.state = "walk";
          c.tx = CHICKEN_ZONE.minX + Math.random() * (CHICKEN_ZONE.maxX - CHICKEN_ZONE.minX);
          c.ty = CHICKEN_ZONE.minY + Math.random() * (CHICKEN_ZONE.maxY - CHICKEN_ZONE.minY);
          c.dir = c.tx > c.x ? 1 : -1;
          c.until = now + 6000;
        } else {
          c.state = "idle";
          c.until = now + 800 + Math.random() * 2600;
        }
      }
      if (c.state === "walk") {
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.05) {
          c.state = "idle";
          c.until = now + 800 + Math.random() * 2600;
        } else {
          const sp = 0.45 * dt;
          c.x += (dx / dist) * sp;
          c.y += (dy / dist) * sp;
        }
      }
    }
    // Clouds drift.
    for (const cl of this.clouds) {
      cl.x += cl.vx * dt;
      if (cl.x > 1.3) cl.x = -0.3;
    }
    // Particles.
    const fx = gameStore.drainFx();
    for (const e of fx) {
      if (e.plotIndex == null) continue;
      const { x, y } = plotTile(e.plotIndex);
      if (e.kind === "sparkle") {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.particles.push({
            tx: x,
            ty: y,
            vx: Math.cos(a) * 0.5,
            vy: Math.sin(a) * 0.25,
            rise: 22 + Math.random() * 16,
            age: 0,
            life: 0.7 + Math.random() * 0.3,
            size: 2.4 + Math.random() * 2,
            color: Math.random() < 0.5 ? "#ffe27a" : "#a5f3b4",
          });
        }
      } else if (e.kind === "text" && e.text) {
        this.particles.push({
          tx: x,
          ty: y,
          vx: 0,
          vy: 0,
          rise: 46,
          age: 0,
          life: 1.1,
          size: 12,
          color: "#d9f99d",
          text: e.text,
        });
      }
    }
    for (const p of this.particles) p.age += dt;
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  private draw(now: number) {
    const { ctx } = this;
    const w = this.cssW;
    const h = this.cssH;

    // Land fills the whole screen — base grass color under the tiles so no
    // seams or void ever show.
    ctx.fillStyle = "#4c9c3c";
    ctx.fillRect(0, 0, w, h);

    const state = gameStore.getState();
    const timeNow = Date.now();
    const unlockedCount = state.plots.filter((p) => p.unlocked).length;
    const nextPrice = plotPrice(unlockedCount);

    // Visible tile range from the viewport corners (a = x−y, b = x+y).
    const corners = [
      screenToTile(0, 0, this.cam, this.viewW, this.viewH),
      screenToTile(w, 0, this.cam, this.viewW, this.viewH),
      screenToTile(0, h, this.cam, this.viewW, this.viewH),
      screenToTile(w, h, this.cam, this.viewW, this.viewH),
    ];
    const aVals = corners.map((c) => c.x - c.y);
    const bVals = corners.map((c) => c.x + c.y);
    const aMin = Math.floor(Math.min(...aVals)) - 2;
    const aMax = Math.ceil(Math.max(...aVals)) + 2;
    const bMin = Math.floor(Math.min(...bVals)) - 2;
    const bMax = Math.ceil(Math.max(...bVals)) + 3;

    // Ground pass (back to front) + procedural countryside collection.
    const objects: SceneObject[] = [];
    for (let b = bMin; b <= bMax; b++) {
      for (let x = Math.ceil((aMin + b) / 2); x <= Math.floor((aMax + b) / 2); x++) {
        const y = b - x;
        this.drawGround(x, y, state, timeNow, nextPrice, now);

        // Countryside: strays near the farm, groves further out, deep forest
        // at the horizon — all deterministic from the tile hash.
        const d = farmDistance(x, y);
        if (d > 0) {
          const hsh = tileHash(x, y);
          const tree =
            d >= 6 ? hsh % 4 !== 0 : d >= 3 ? hsh % 5 === 0 : hsh % 11 === 0;
          if (tree) {
            objects.push({ depth: x + y, x, y, kind: "tree" });
          } else if (hsh % 17 === 3) {
            objects.push({ depth: x + y, x, y, kind: "flower" });
          } else if (hsh % 29 === 7) {
            objects.push({ depth: x + y, x, y, kind: "rock" });
          }
        }
      }
    }

    // Farm decor + fences + chickens + crops, depth sorted with the rest.
    for (const d of DECOR) objects.push({ depth: d.x + d.y, x: d.x, y: d.y, kind: d.type });
    for (const f of this.fences) {
      const bias = f.side === "N" || f.side === "W" ? -0.45 : 0.45;
      objects.push({ depth: f.x + f.y + bias, x: f.x, y: f.y, kind: "fence", fence: f });
    }
    for (const c of this.chickens) {
      objects.push({ depth: c.x + c.y, x: c.x, y: c.y, kind: "chicken", chicken: c });
    }
    state.plots.forEach((p, i) => {
      if (p.unlocked && p.crop != null) {
        const { x, y } = plotTile(i);
        objects.push({ depth: x + y, x, y, kind: "crop", plotIndex: i });
      }
    });
    objects.sort((a, b) => a.depth - b.depth || a.x - b.x);

    for (const o of objects) {
      const [sx, sy] = tileToScreen(o.x, o.y, this.cam, this.viewW, this.viewH);
      switch (o.kind) {
        case "crop":
          if (o.plotIndex != null) this.drawCrop(sx, sy, state.plots[o.plotIndex], timeNow);
          break;
        case "fence":
          if (o.fence) this.drawFence(sx, sy, o.fence);
          break;
        case "tree":
          this.drawTree(sx, sy);
          break;
        case "house":
          this.drawHouse(sx, sy);
          break;
        case "barn":
          this.drawBarn(sx, sy);
          break;
        case "windmill":
          this.drawWindmill(sx, sy, now);
          break;
        case "rock":
          this.drawRock(sx, sy);
          break;
        case "flower":
          this.drawFlowers(sx, sy, o.x, o.y);
          break;
        case "chicken":
          if (o.chicken) this.drawChicken(sx, sy, o.chicken, now);
          break;
      }
    }

    this.drawButterflies(now);
    this.drawParticles();
    this.drawCloudShadows(w, h);

    // Vignette for depth.
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,20,25,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- Environment -----------------------------------------------------------

  private drawCloudShadows(w: number, h: number) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "rgba(10,30,25,0.10)";
    for (const cl of this.clouds) {
      const x = cl.x * w;
      const y = cl.y * h;
      const s = cl.scale * Math.min(w, h) * 0.09;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.8, s * 0.8, 0, 0, Math.PI * 2);
      ctx.ellipse(x + s * 1.2, y + s * 0.3, s * 1.2, s * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(x - s * 1.1, y + s * 0.25, s, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Ground ------------------------------------------------------------------

  private diamondPath(sx: number, sy: number, hw: number, hh: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(sx, sy - hh);
    ctx.lineTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
  }

  private drawGround(
    tx: number,
    ty: number,
    state: ReturnType<typeof gameStore.getState>,
    timeNow: number,
    nextPrice: number,
    animNow: number,
  ) {
    const { ctx } = this;
    const [sx, sy] = tileToScreen(tx, ty, this.cam, this.viewW, this.viewH);
    const z = this.cam.zoom;
    const hw = (TILE_W / 2) * z;
    const hh = (TILE_H / 2) * z;
    const h = tileHash(tx, ty);

    const field = isFieldTile(tx, ty);
    const plotIdx = plotIndexAt(tx, ty);
    const plot = plotIdx >= 0 ? state.plots[plotIdx] : null;

    if (isPond(tx, ty)) {
      this.blitTile("water", sx, sy);
      // animated shimmer
      ctx.save();
      this.diamondPath(sx, sy, hw, hh);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.4 * z;
      const ph = animNow / 900 + h;
      for (let k = 0; k < 2; k++) {
        const ox = Math.sin(ph + k * 2.1) * hw * 0.3;
        const oy = Math.cos(ph * 0.7 + k) * hh * 0.25;
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.35 + ox, sy + oy);
        ctx.quadraticCurveTo(sx + ox, sy - hh * 0.22 + oy, sx + hw * 0.35 + ox, sy + oy);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (isPath(tx, ty)) {
      this.blitTile("path", sx, sy);
      return;
    }

    if (plot && plot.unlocked) {
      this.blitTile(h % 2 === 0 ? "soilA" : "soilB", sx, sy);
    } else {
      this.blitTile(h % 2 === 0 ? "grassA" : "grassB", sx, sy);
    }

    // Locked plot: overgrowth + lock + price.
    if (field && plot && !plot.unlocked) {
      ctx.fillStyle = "rgba(35,65,28,0.55)";
      this.diamondPath(sx, sy, hw, hh);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${14 * z}px ${EMOJI_FONT}`;
      ctx.fillText("🔒", sx, sy - 3 * z);
      ctx.font = `700 ${10 * z}px ${UI_FONT}`;
      ctx.fillStyle = "#ffe27a";
      ctx.fillText(`$${nextPrice}`, sx, sy + 9 * z);
    }

    // Hover highlight on the field.
    if (field && this.hover.x === tx && this.hover.y === ty && !this.down) {
      this.diamondPath(sx, sy, hw, hh);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      if (plot && plot.unlocked && plot.crop == null) {
        const def = CROPS[state.selectedCrop];
        const sprite = getCropSprite(state.selectedCrop);
        ctx.globalAlpha = 0.45;
        if (sprite && sprite.ok) {
          const sz = TILE_H * 1.4 * z;
          ctx.drawImage(
            sprite.img,
            0,
            0,
            sprite.img.naturalWidth / sprite.frames,
            sprite.img.naturalHeight,
            sx - sz / 2,
            sy + 4 * z - sz,
            sz,
            sz,
          );
        } else {
          ctx.font = `${20 * z}px ${EMOJI_FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(def.emoji, sx, sy);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- Objects -------------------------------------------------------------------

  private shadow(sx: number, sy: number, rx: number, ry: number, alpha = 0.22) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = `rgba(0,25,10,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCrop(
    sx: number,
    sy: number,
    plot: ReturnType<typeof gameStore.getState>["plots"][number],
    timeNow: number,
  ) {
    if (plot.crop == null) return;
    const { ctx } = this;
    const z = this.cam.zoom;
    const def = CROPS[plot.crop];
    const p = plantProgress(plot, timeNow);
    const ready = isReady(plot, timeNow);
    const sprite = getCropSprite(plot.crop);

    const size = TILE_H * (0.9 + 0.85 * p) * z;
    const baseY = sy + 5 * z;
    const pulse = ready ? 6 + 5 * Math.sin(timeNow / 280) : 0;

    this.shadow(sx, baseY + 1 * z, size * 0.3, size * 0.11);

    ctx.save();
    if (ready) {
      ctx.shadowColor = "rgba(120,255,140,0.9)";
      ctx.shadowBlur = pulse;
    }
    if (sprite && sprite.ok) {
      const fw = sprite.img.naturalWidth / sprite.frames;
      const fh = sprite.img.naturalHeight;
      const frame = Math.min(sprite.frames - 1, Math.floor(p * sprite.frames));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sprite.img, frame * fw, 0, fw, fh, sx - size / 2, baseY - size, size, size);
    } else {
      ctx.font = `${size * 0.8}px ${EMOJI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 0.5 + 0.5 * p;
      ctx.fillText(def.emoji, sx, baseY);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    const topY = baseY - size - 4 * z;
    if (ready) {
      const pw = 34 * z;
      const ph = 12 * z;
      ctx.beginPath();
      ctx.roundRect(sx - pw / 2, topY - ph, pw, ph, ph / 2);
      ctx.fillStyle = "#2fbf52";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${7 * z}px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("READY", sx, topY - ph / 2 + 0.5);
    } else {
      const bw = 30 * z;
      const bh = 5 * z;
      ctx.beginPath();
      ctx.roundRect(sx - bw / 2, topY - bh, bw, bh, bh / 2);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(sx - bw / 2, topY - bh, bw * p, bh, bh / 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `600 ${8 * z}px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(fmtTime(def.growSeconds * (1 - p)), sx, topY - bh - 1 * z);
    }
  }

  private fenceEndpoints(sx: number, sy: number, side: FenceSeg["side"]): [[number, number], [number, number]] {
    const z = this.cam.zoom;
    const hw = (TILE_W / 2) * z;
    const hh = (TILE_H / 2) * z;
    const T: [number, number] = [sx, sy - hh];
    const R: [number, number] = [sx + hw, sy];
    const B: [number, number] = [sx, sy + hh];
    const L: [number, number] = [sx - hw, sy];
    switch (side) {
      case "N":
        return [T, R];
      case "W":
        return [L, T];
      case "S":
        return [L, B];
      case "E":
        return [B, R];
    }
  }

  private drawFence(sx: number, sy: number, seg: FenceSeg) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const [a, b] = this.fenceEndpoints(sx, sy, seg.side);
    const postH = 13 * z;
    const post = (px: number, py: number) => {
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(px - 1.6 * z, py - postH, 3.2 * z, postH);
      ctx.fillStyle = "#8f6238";
      ctx.fillRect(px - 1.6 * z, py - postH, 3.2 * z, 2.2 * z);
    };
    // Rails.
    ctx.strokeStyle = "#8a5e36";
    ctx.lineWidth = 2.2 * z;
    for (const lift of [9 * z, 4.5 * z]) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - lift);
      ctx.lineTo(b[0], b[1] - lift);
      ctx.stroke();
    }
    post(a[0], a[1]);
    post(b[0], b[1]);
  }

  private drawTree(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    this.shadow(sx, sy + 2 * z, 14 * z, 5 * z);
    // trunk
    const trunkGrad = ctx.createLinearGradient(sx - 3 * z, 0, sx + 3 * z, 0);
    trunkGrad.addColorStop(0, "#5a3d22");
    trunkGrad.addColorStop(1, "#7a5230");
    ctx.fillStyle = trunkGrad;
    ctx.fillRect(sx - 2.6 * z, sy - 14 * z, 5.2 * z, 14 * z);
    // foliage: dark base, mid, light top
    const cy = sy - 22 * z;
    const blob = (bx: number, by: number, br: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    };
    blob(sx - 8 * z, cy + 4 * z, 10 * z, "#1f6e2d");
    blob(sx + 8 * z, cy + 4 * z, 10 * z, "#1f6e2d");
    blob(sx, cy + 6 * z, 11 * z, "#1f6e2d");
    blob(sx - 5 * z, cy - 2 * z, 10 * z, "#2f8f3a");
    blob(sx + 5 * z, cy - 2 * z, 10 * z, "#2f8f3a");
    blob(sx, cy - 7 * z, 10 * z, "#37a144");
    blob(sx - 3.5 * z, cy - 9 * z, 5.5 * z, "#4cb858");
  }

  private drawHouse(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const w = 46 * z;
    const wallH = 28 * z;
    const x = sx - w / 2;
    const yTop = sy - wallH;
    this.shadow(sx, sy + 3 * z, w * 0.62, 8 * z, 0.25);
    // walls with two-tone shading
    const wallGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    wallGrad.addColorStop(0, "#f4e8cd");
    wallGrad.addColorStop(1, "#dcc9a3");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(x, yTop, w, wallH);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(x, yTop, w, wallH);
    // roof with gradient + overhang
    const roofGrad = ctx.createLinearGradient(0, yTop - 22 * z, 0, yTop);
    roofGrad.addColorStop(0, "#d95a41");
    roofGrad.addColorStop(1, "#a83a28");
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(x - 6 * z, yTop);
    ctx.lineTo(x + w + 6 * z, yTop);
    ctx.lineTo(sx, yTop - 22 * z);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.moveTo(x - 6 * z, yTop);
    ctx.lineTo(sx, yTop - 22 * z);
    ctx.stroke();
    // chimney
    ctx.fillStyle = "#9a5b41";
    ctx.fillRect(sx + 8 * z, yTop - 16 * z, 6 * z, 10 * z);
    // door
    ctx.fillStyle = "#7c5230";
    ctx.beginPath();
    ctx.roundRect(sx - 6 * z, sy - 15 * z, 12 * z, 15 * z, 2 * z);
    ctx.fill();
    ctx.fillStyle = "#ffd76e";
    ctx.beginPath();
    ctx.arc(sx + 3.4 * z, sy - 7.5 * z, 1.2 * z, 0, Math.PI * 2);
    ctx.fill();
    // windows
    const win = (wx: number) => {
      ctx.fillStyle = "#bfe9f7";
      ctx.fillRect(wx, yTop + 6 * z, 9 * z, 8 * z);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2 * z;
      ctx.strokeRect(wx, yTop + 6 * z, 9 * z, 8 * z);
      ctx.beginPath();
      ctx.moveTo(wx, yTop + 10 * z);
      ctx.lineTo(wx + 9 * z, yTop + 10 * z);
      ctx.stroke();
    };
    win(x + 5 * z);
    win(x + w - 14 * z);
  }

  private drawBarn(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const w = 50 * z;
    const wallH = 30 * z;
    const x = sx - w / 2;
    const yTop = sy - wallH;
    this.shadow(sx, sy + 3 * z, w * 0.62, 8 * z, 0.25);
    const wallGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    wallGrad.addColorStop(0, "#cc4a34");
    wallGrad.addColorStop(1, "#a33324");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(x, yTop, w, wallH);
    // white trim
    ctx.strokeStyle = "#f3ead6";
    ctx.lineWidth = 1.6 * z;
    ctx.strokeRect(x, yTop, w, wallH);
    // gambrel roof
    const roofGrad = ctx.createLinearGradient(0, yTop - 14 * z, 0, yTop);
    roofGrad.addColorStop(0, "#a33a2a");
    roofGrad.addColorStop(1, "#7e2519");
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(x - 5 * z, yTop);
    ctx.lineTo(x + w * 0.25, yTop - 13 * z);
    ctx.lineTo(x + w * 0.75, yTop - 13 * z);
    ctx.lineTo(x + w + 5 * z, yTop);
    ctx.closePath();
    ctx.fill();
    // hayloft window
    ctx.fillStyle = "#f3ead6";
    ctx.beginPath();
    ctx.arc(sx, yTop - 5 * z, 3.4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7c5230";
    ctx.beginPath();
    ctx.arc(sx, yTop - 5 * z, 2 * z, 0, Math.PI * 2);
    ctx.fill();
    // big white door with X
    const dw = 18 * z;
    const dh = 20 * z;
    ctx.fillStyle = "#f3ead6";
    ctx.fillRect(sx - dw / 2, sy - dh, dw, dh);
    ctx.strokeStyle = "#8f2f23";
    ctx.lineWidth = 1.6 * z;
    ctx.strokeRect(sx - dw / 2, sy - dh, dw, dh);
    ctx.beginPath();
    ctx.moveTo(sx - dw / 2, sy - dh);
    ctx.lineTo(sx + dw / 2, sy);
    ctx.moveTo(sx + dw / 2, sy - dh);
    ctx.lineTo(sx - dw / 2, sy);
    ctx.stroke();
    // hay bale
    ctx.fillStyle = "#d9b356";
    ctx.beginPath();
    ctx.roundRect(x + w - 8 * z, sy - 8 * z, 12 * z, 8 * z, 2 * z);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,100,30,0.7)";
    ctx.lineWidth = 1 * z;
    ctx.strokeRect(x + w - 6 * z, sy - 8 * z, 0.1, 8 * z);
    ctx.strokeRect(x + w - 1 * z, sy - 8 * z, 0.1, 8 * z);
  }

  private drawWindmill(sx: number, sy: number, now: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    this.shadow(sx, sy + 2 * z, 13 * z, 5 * z, 0.25);
    // tower
    const grad = ctx.createLinearGradient(sx - 8 * z, 0, sx + 8 * z, 0);
    grad.addColorStop(0, "#c9c2b4");
    grad.addColorStop(1, "#a49c8c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx - 9 * z, sy);
    ctx.lineTo(sx - 5 * z, sy - 34 * z);
    ctx.lineTo(sx + 5 * z, sy - 34 * z);
    ctx.lineTo(sx + 9 * z, sy);
    ctx.closePath();
    ctx.fill();
    // door
    ctx.fillStyle = "#6d4a2a";
    ctx.beginPath();
    ctx.roundRect(sx - 3.2 * z, sy - 9 * z, 6.4 * z, 9 * z, 2 * z);
    ctx.fill();
    // cap
    ctx.fillStyle = "#8f2f23";
    ctx.beginPath();
    ctx.arc(sx, sy - 34 * z, 6.5 * z, Math.PI, 0);
    ctx.fill();
    // rotating blades
    const hub: [number, number] = [sx, sy - 34 * z];
    const ang = (now / 1000) * 0.9;
    ctx.save();
    ctx.translate(hub[0], hub[1]);
    ctx.rotate(ang);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "rgba(245,240,225,0.95)";
      ctx.beginPath();
      ctx.moveTo(0, -1.4 * z);
      ctx.lineTo(20 * z, -4.5 * z);
      ctx.lineTo(20 * z, 1.2 * z);
      ctx.lineTo(0, 1.4 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(120,90,50,0.5)";
      ctx.lineWidth = 0.8 * z;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#5d4324";
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], 2.2 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRock(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    this.shadow(sx, sy + 1.5 * z, 10 * z, 4 * z, 0.18);
    const rock = (rx: number, ry: number, r: number, c: string) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(rx, ry, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    rock(sx - 4 * z, sy - 2 * z, 6 * z, "#9aa0a6");
    rock(sx + 4.5 * z, sy - 1 * z, 4.5 * z, "#7f858c");
    rock(sx - 2 * z, sy - 5 * z, 3.4 * z, "#b7bcc2");
  }

  private drawFlowers(sx: number, sy: number, tx: number, ty: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const rnd = mulberry32(tileHash(tx, ty));
    const colors = ["#f6c445", "#e88ac2", "#ef6a5a", "#c9b7f5"];
    for (let i = 0; i < 6; i++) {
      const fx = sx + (rnd() - 0.5) * TILE_W * 0.55 * z;
      const fy = sy + (rnd() - 0.5) * TILE_H * 0.5 * z;
      ctx.strokeStyle = "#2f7d2f";
      ctx.lineWidth = 1 * z;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 4 * z);
      ctx.stroke();
      ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
      ctx.beginPath();
      ctx.arc(fx, fy - 5 * z, 1.8 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(fx - 0.5 * z, fy - 5.5 * z, 0.6 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawChicken(sx: number, sy: number, c: Chicken, now: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const bob = c.state === "walk" ? Math.sin(now / 90 + c.phase) * 1.4 * z : Math.sin(now / 500 + c.phase) * 0.5 * z;
    const d = c.dir;
    this.shadow(sx, sy + 1 * z, 5 * z, 2 * z, 0.2);
    ctx.save();
    ctx.translate(sx, sy - 4 * z + bob);
    // body
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // wing shading
    ctx.fillStyle = "rgba(180,170,150,0.5)";
    ctx.beginPath();
    ctx.ellipse(-d * 1 * z, 0.5 * z, 2.6 * z, 1.8 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.fillStyle = "#e8e2d2";
    ctx.beginPath();
    ctx.ellipse(-d * 4.4 * z, -1.4 * z, 2 * z, 1.4 * z, d * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.arc(d * 3.6 * z, -3.4 * z, 2.4 * z, 0, Math.PI * 2);
    ctx.fill();
    // comb
    ctx.fillStyle = "#e2402e";
    ctx.beginPath();
    ctx.arc(d * 3.6 * z, -5.6 * z, 1 * z, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = "#eda23c";
    ctx.beginPath();
    ctx.moveTo(d * 5.6 * z, -3.4 * z);
    ctx.lineTo(d * 7.2 * z, -2.9 * z);
    ctx.lineTo(d * 5.6 * z, -2.3 * z);
    ctx.closePath();
    ctx.fill();
    // eye
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(d * 3.9 * z, -3.7 * z, 0.5 * z, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.strokeStyle = "#eda23c";
    ctx.lineWidth = 1 * z;
    const step = c.state === "walk" ? Math.sin(now / 90 + c.phase) * 1.6 * z : 0;
    ctx.beginPath();
    ctx.moveTo(-1.4 * z, 3.4 * z);
    ctx.lineTo(-1.4 * z + step, 5.6 * z);
    ctx.moveTo(1.4 * z, 3.4 * z);
    ctx.lineTo(1.4 * z - step, 5.6 * z);
    ctx.stroke();
    ctx.restore();
  }

  private drawButterflies(now: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    for (const b of this.butterflies) {
      const t = now / 1000;
      const tx = b.cx + Math.cos(t * b.speed + b.phase) * b.r;
      const ty = b.cy + Math.sin(t * b.speed * 1.3 + b.phase) * b.r * 0.7;
      const [sx, sy] = tileToScreen(tx, ty, this.cam, this.viewW, this.viewH);
      const alt = 26 * z + Math.sin(t * 3 + b.phase) * 5 * z;
      const flap = Math.abs(Math.sin(t * 10 + b.phase));
      ctx.save();
      ctx.translate(sx, sy - alt);
      ctx.fillStyle = b.color;
      const ww = 3.2 * z * (0.4 + 0.6 * flap);
      ctx.beginPath();
      ctx.ellipse(-ww / 2, 0, ww / 2 + 0.4 * z, 2 * z, -0.3, 0, Math.PI * 2);
      ctx.ellipse(ww / 2, 0, ww / 2 + 0.4 * z, 2 * z, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3b3b3b";
      ctx.fillRect(-0.5 * z, -1.8 * z, 1 * z, 3.6 * z);
      ctx.restore();
    }
  }

  private drawParticles() {
    const { ctx } = this;
    const z = this.cam.zoom;
    for (const p of this.particles) {
      const k = p.age / p.life;
      const [bx, by] = tileToScreen(
        p.tx + p.vx * p.age,
        p.ty + p.vy * p.age,
        this.cam,
        this.viewW,
        this.viewH,
      );
      const sy = by - p.rise * k * z;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (p.text) {
        ctx.font = `800 ${p.size * z}px ${UI_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3 * z;
        ctx.strokeStyle = "rgba(20,40,20,0.8)";
        ctx.strokeText(p.text, bx, sy);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, bx, sy);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(bx, sy, p.size * z * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
