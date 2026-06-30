"use client";

import { CROPS } from "./crops";
import { cropSpriteUrl } from "./sprites";
import { gameStore, isReady, plantProgress, plotPrice } from "./store";
import { CropId } from "./types";
import {
  Camera,
  DECOR,
  Decor,
  FIELD_CENTER,
  ISLAND_MAX_X,
  ISLAND_MAX_Y,
  ISLAND_MIN_X,
  ISLAND_MIN_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_H,
  TILE_THICK,
  TILE_W,
  isFieldTile,
  isIsland,
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

// Optional per-crop artwork (the SVG icons). Loaded lazily + cached.
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

// A tall object (crop / tree / building) to be depth-sorted in the draw pass.
interface SceneObject {
  depth: number;
  x: number;
  y: number;
  kind: "crop" | Decor["type"];
  plotIndex?: number;
}

/**
 * Renders the isometric farm island and maps pointer interaction (pan / zoom /
 * tap-a-plot) back to the game store.
 */
export class FarmRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onTileClick: (index: number) => void;
  private raf = 0;
  private cssW = 0;
  private cssH = 0;
  // Projection origin: the world is centered on (viewW/2, viewH/2). These are
  // offset from the real canvas size so the island sits left of the HUD panel.
  private viewW = 0;
  private viewH = 0;
  private userAdjusted = false; // true once the player pans/zooms (stops auto-fit)
  private ro: ResizeObserver | null = null;

  private cam: Camera = { lookX: FIELD_CENTER.x, lookY: FIELD_CENTER.y, zoom: 1 };
  private islandTiles: { x: number; y: number }[] = [];

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

    // Precompute island tiles in back-to-front order.
    for (let y = ISLAND_MIN_Y; y <= ISLAND_MAX_Y; y++) {
      for (let x = ISLAND_MIN_X; x <= ISLAND_MAX_X; x++) {
        this.islandTiles.push({ x, y });
      }
    }
    this.islandTiles.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);

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
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
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
    this.userAdjusted = false; // resume auto-fit on resize
  }

  zoomBy(factor: number) {
    this.cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.cam.zoom * factor));
    this.userAdjusted = true;
  }

  // ---- Sizing ------------------------------------------------------------

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

    // Reserve room on the right for the HUD panel on wide screens, and nudge
    // the view down a touch so the island clears the floating top bar.
    const panel = this.cssW > 900 ? 330 : 0;
    this.viewW = this.cssW - panel;
    this.viewH = this.cssH + 40;

    // Auto-fit to the viewport until the player pans or zooms themselves.
    if (!this.userAdjusted) this.recenter();
  }

  /** Zoom that makes the whole island fill most of the available view. */
  private fitZoom(): number {
    const spanX =
      ISLAND_MAX_X - ISLAND_MIN_Y - (ISLAND_MIN_X - ISLAND_MAX_Y); // (x-y) span
    const spanY =
      ISLAND_MAX_X + ISLAND_MAX_Y - (ISLAND_MIN_X + ISLAND_MIN_Y); // (x+y) span
    const worldW = spanX * (TILE_W / 2);
    const worldH = spanY * (TILE_H / 2);
    const fit = Math.min(
      (this.viewW * 0.94) / worldW,
      (this.cssH * 0.8) / worldH,
    );
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit));
  }

  // ---- Input -------------------------------------------------------------

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
        this.userAdjusted = true; // panning disables auto-fit
      }
      const d = panDelta(dx, dy, { ...this.cam, zoom: this.startZoom });
      this.cam.lookX = this.clampLook(this.startLookX + d.dLookX, ISLAND_MIN_X, ISLAND_MAX_X);
      this.cam.lookY = this.clampLook(this.startLookY + d.dLookY, ISLAND_MIN_Y, ISLAND_MAX_Y);
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
    if (this.moved) return; // it was a pan, not a tap
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

  // ---- Render loop -------------------------------------------------------

  private loop() {
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  private draw() {
    const { ctx } = this;
    const w = this.cssW;
    const h = this.cssH;

    // Ocean fills the whole screen — the island sits on it (Clash/Hay Day style).
    const sea = ctx.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, "#2f9bc9");
    sea.addColorStop(1, "#1b6e9b");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, w, h);
    this.drawWaves(w, h);
    this.drawIslandBase();

    const state = gameStore.getState();
    const now = Date.now();
    const unlockedCount = state.plots.filter((p) => p.unlocked).length;
    const nextPrice = plotPrice(unlockedCount);

    // 1) Ground layer (back to front).
    for (const t of this.islandTiles) this.drawGround(t.x, t.y, state, now, nextPrice);

    // 2) Tall objects (crops + decor), depth sorted.
    const objects: SceneObject[] = [];
    for (const d of DECOR) objects.push({ depth: d.x + d.y, x: d.x, y: d.y, kind: d.type });
    state.plots.forEach((p, i) => {
      if (p.unlocked && p.crop != null) {
        const { x, y } = plotTile(i);
        objects.push({ depth: x + y, x, y, kind: "crop", plotIndex: i });
      }
    });
    objects.sort((a, b) => a.depth - b.depth || a.x - b.x);

    for (const o of objects) {
      const [sx, sy] = tileToScreen(o.x, o.y, this.cam, this.viewW, this.viewH);
      if (o.kind === "crop" && o.plotIndex != null) {
        this.drawCrop(sx, sy, state.plots[o.plotIndex], now);
      } else if (o.kind === "tree") {
        this.drawTree(sx, sy);
      } else if (o.kind === "house") {
        this.drawHouse(sx, sy);
      } else if (o.kind === "barn") {
        this.drawBarn(sx, sy);
      }
    }
  }

  // ---- Ground tiles ------------------------------------------------------

  private drawWaves(w: number, h: number) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 110; i++) {
      const x = (i * 167) % (w + 40);
      const y = (i * 97) % (h + 40);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 5, y - 4, x + 11, y);
      ctx.quadraticCurveTo(x + 17, y + 4, x + 23, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private islandOuterCorners(): Record<
    "top" | "right" | "bottom" | "left",
    [number, number]
  > {
    const hw = (TILE_W / 2) * this.cam.zoom;
    const hh = (TILE_H / 2) * this.cam.zoom;
    const t = TILE_THICK * this.cam.zoom;
    const ts = (x: number, y: number) =>
      tileToScreen(x, y, this.cam, this.viewW, this.viewH);
    const top = ts(ISLAND_MIN_X, ISLAND_MIN_Y);
    const right = ts(ISLAND_MAX_X, ISLAND_MIN_Y);
    const bottom = ts(ISLAND_MAX_X, ISLAND_MAX_Y);
    const left = ts(ISLAND_MIN_X, ISLAND_MAX_Y);
    return {
      top: [top[0], top[1] - hh],
      right: [right[0] + hw, right[1]],
      bottom: [bottom[0], bottom[1] + hh + t],
      left: [left[0] - hw, left[1]],
    };
  }

  /** Sand beach + shallow-water ring beneath the island tiles. */
  private drawIslandBase() {
    const { ctx } = this;
    const c = this.islandOuterCorners();
    const cx = (c.top[0] + c.bottom[0]) / 2;
    const cy = (c.left[1] + c.right[1]) / 2;
    const z = this.cam.zoom;

    const expand = (p: [number, number], by: number): [number, number] => {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [p[0] + (dx / len) * by, p[1] + (dy / len) * by];
    };
    const fillDiamond = (by: number, color: string) => {
      const pts = [
        expand(c.top, by),
        expand(c.right, by),
        expand(c.bottom, by),
        expand(c.left, by),
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    fillDiamond(18 * z, "rgba(150,226,238,0.45)"); // shallow water
    fillDiamond(8 * z, "#e7d29a"); // sand beach
  }

  private diamondPath(sx: number, sy: number, hw: number, hh: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(sx, sy - hh);
    ctx.lineTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
  }

  private drawTileBlock(
    sx: number,
    sy: number,
    top: string,
    side: string,
  ) {
    const { ctx } = this;
    const hw = (TILE_W / 2) * this.cam.zoom;
    const hh = (TILE_H / 2) * this.cam.zoom;
    const t = TILE_THICK * this.cam.zoom;

    // Side faces (darker).
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx, sy + hh + t);
    ctx.lineTo(sx - hw, sy + t);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx, sy + hh + t);
    ctx.lineTo(sx + hw, sy + t);
    ctx.closePath();
    ctx.fill();

    // Top.
    this.diamondPath(sx, sy, hw, hh);
    ctx.fillStyle = top;
    ctx.fill();
  }

  private drawGround(
    tx: number,
    ty: number,
    state: ReturnType<typeof gameStore.getState>,
    now: number,
    nextPrice: number,
  ) {
    if (!isIsland(tx, ty)) return;
    const { ctx } = this;
    const [sx, sy] = tileToScreen(tx, ty, this.cam, this.viewW, this.viewH);
    const hw = (TILE_W / 2) * this.cam.zoom;
    const hh = (TILE_H / 2) * this.cam.zoom;
    const checker = (tx + ty) % 2 === 0;

    const field = isFieldTile(tx, ty);
    const plotIdx = plotIndexAt(tx, ty);
    const plot = plotIdx >= 0 ? state.plots[plotIdx] : null;

    if (isPond(tx, ty)) {
      this.drawTileBlock(sx, sy, checker ? "#49a7da" : "#3f9bcf", "#2c6f99");
      ctx.save();
      this.diamondPath(sx, sy, hw, hh);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.4 * this.cam.zoom;
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.4, sy);
      ctx.quadraticCurveTo(sx, sy - hh * 0.3, sx + hw * 0.4, sy);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (plot && plot.unlocked) {
      // Tilled soil.
      this.drawTileBlock(sx, sy, checker ? "#8a5a3a" : "#7e5133", "#5a3a25");
      ctx.save();
      this.diamondPath(sx, sy, hw, hh);
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.16)";
      ctx.lineWidth = 1.2 * this.cam.zoom;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy + (k * hh) / 2);
        ctx.lineTo(sx, sy + hh + (k * hh) / 2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Grass (also under locked plots).
      this.drawTileBlock(sx, sy, checker ? "#57ad46" : "#4f9f3f", "#356f29");
    }

    // Locked plot: overgrowth + lock + price.
    if (field && plot && !plot.unlocked) {
      ctx.fillStyle = "rgba(40,70,30,0.55)";
      this.diamondPath(sx, sy, hw, hh);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${14 * this.cam.zoom}px ${EMOJI_FONT}`;
      ctx.fillText("🔒", sx, sy - 3 * this.cam.zoom);
      ctx.font = `700 ${10 * this.cam.zoom}px ${UI_FONT}`;
      ctx.fillStyle = "#ffe27a";
      ctx.fillText(`$${nextPrice}`, sx, sy + 9 * this.cam.zoom);
    }

    // Hover highlight on the field.
    if (field && this.hover.x === tx && this.hover.y === ty && !this.down) {
      this.diamondPath(sx, sy, hw, hh);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill();
      // ghost of the selected crop on empty unlocked tiles
      if (plot && plot.unlocked && plot.crop == null) {
        const def = CROPS[state.selectedCrop];
        const sprite = getCropSprite(state.selectedCrop);
        ctx.globalAlpha = 0.45;
        if (sprite && sprite.ok) {
          const sz = TILE_H * 1.4 * this.cam.zoom;
          ctx.drawImage(sprite.img, 0, 0, sprite.img.naturalWidth / sprite.frames, sprite.img.naturalHeight, sx - sz / 2, sy + 4 * this.cam.zoom - sz, sz, sz);
        } else {
          ctx.font = `${20 * this.cam.zoom}px ${EMOJI_FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(def.emoji, sx, sy);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- Crops -------------------------------------------------------------

  private drawCrop(
    sx: number,
    sy: number,
    plot: ReturnType<typeof gameStore.getState>["plots"][number],
    now: number,
  ) {
    if (plot.crop == null) return;
    const { ctx } = this;
    const z = this.cam.zoom;
    const def = CROPS[plot.crop];
    const p = plantProgress(plot, now);
    const ready = isReady(plot, now);
    const sprite = getCropSprite(plot.crop);

    const size = TILE_H * (0.9 + 0.85 * p) * z;
    const baseY = sy + 5 * z; // sit on the soil
    const pulse = ready ? 6 + 5 * Math.sin(now / 280) : 0;

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

    // Status above the plant.
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

  // ---- Decor billboards --------------------------------------------------

  private drawTree(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    ctx.fillStyle = "#6a4a2a";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1 * z;
    const trunkW = 5 * z;
    const trunkH = 13 * z;
    ctx.fillRect(sx - trunkW / 2, sy - trunkH, trunkW, trunkH);
    const cy = sy - trunkH - 9 * z;
    const blobs: [number, number, number][] = [
      [sx, cy - 6 * z, 12 * z],
      [sx - 9 * z, cy, 10 * z],
      [sx + 9 * z, cy, 10 * z],
      [sx, cy + 3 * z, 12 * z],
    ];
    ctx.fillStyle = "#2f8f3a";
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(sx - 4 * z, cy - 7 * z, 5 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHouse(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const w = 44 * z;
    const wallH = 28 * z;
    const x = sx - w / 2;
    const yTop = sy - wallH;
    // walls
    ctx.fillStyle = "#efe2c4";
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1 * z;
    ctx.fillRect(x, yTop, w, wallH);
    ctx.strokeRect(x, yTop, w, wallH);
    // roof
    ctx.fillStyle = "#c0432f";
    ctx.beginPath();
    ctx.moveTo(x - 5 * z, yTop);
    ctx.lineTo(x + w + 5 * z, yTop);
    ctx.lineTo(sx, yTop - 20 * z);
    ctx.closePath();
    ctx.fill();
    // door + window
    ctx.fillStyle = "#7c5230";
    ctx.fillRect(sx - 6 * z, sy - 14 * z, 12 * z, 14 * z);
    ctx.fillStyle = "#8fd3ef";
    ctx.fillRect(x + 5 * z, yTop + 6 * z, 9 * z, 9 * z);
    ctx.strokeRect(x + 5 * z, yTop + 6 * z, 9 * z, 9 * z);
  }

  private drawBarn(sx: number, sy: number) {
    const { ctx } = this;
    const z = this.cam.zoom;
    const w = 46 * z;
    const wallH = 28 * z;
    const x = sx - w / 2;
    const yTop = sy - wallH;
    ctx.fillStyle = "#c0432f";
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1 * z;
    ctx.fillRect(x, yTop, w, wallH);
    // gambrel roof
    ctx.fillStyle = "#8f2f23";
    ctx.beginPath();
    ctx.moveTo(x - 4 * z, yTop);
    ctx.lineTo(x + w * 0.25, yTop - 12 * z);
    ctx.lineTo(x + w * 0.75, yTop - 12 * z);
    ctx.lineTo(x + w + 4 * z, yTop);
    ctx.closePath();
    ctx.fill();
    // white door with X
    const dw = 16 * z;
    const dh = 18 * z;
    ctx.fillStyle = "#f3ead6";
    ctx.fillRect(sx - dw / 2, sy - dh, dw, dh);
    ctx.strokeStyle = "#8f2f23";
    ctx.lineWidth = 1.5 * z;
    ctx.strokeRect(sx - dw / 2, sy - dh, dw, dh);
    ctx.beginPath();
    ctx.moveTo(sx - dw / 2, sy - dh);
    ctx.lineTo(sx + dw / 2, sy);
    ctx.moveTo(sx + dw / 2, sy - dh);
    ctx.lineTo(sx - dw / 2, sy);
    ctx.stroke();
  }
}
