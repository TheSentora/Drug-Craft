"use client";

import { CROPS } from "./crops";
import {
  COLS,
  ROWS,
  gameStore,
  isReady,
  plantProgress,
  plotPrice,
} from "./store";
import { Plot } from "./types";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

const EMOJI_FONT =
  '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
const UI_FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';

/**
 * Renders the farm board to a canvas and maps pointer clicks back to plots.
 * State lives in `gameStore`; this class only reads it each frame.
 */
export class FarmRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onTileClick: (index: number) => void;
  private raf = 0;
  private rects: Rect[] = [];
  private cssW = 0;
  private cssH = 0;
  private hovered = -1;
  private ro: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    onTileClick: (index: number) => void,
  ) {
    this.canvas = canvas;
    this.onTileClick = onTileClick;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.handleClick = this.handleClick.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleLeave = this.handleLeave.bind(this);
    this.loop = this.loop.bind(this);

    canvas.addEventListener("click", this.handleClick);
    canvas.addEventListener("mousemove", this.handleMove);
    canvas.addEventListener("mouseleave", this.handleLeave);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
  }

  start() {
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("mousemove", this.handleMove);
    this.canvas.removeEventListener("mouseleave", this.handleLeave);
    this.ro?.disconnect();
  }

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
    this.layout();
  }

  private layout() {
    const pad = Math.max(14, Math.min(this.cssW, this.cssH) * 0.04);
    const gap = Math.max(8, this.cssW * 0.012);
    const availW = this.cssW - pad * 2 - gap * (COLS - 1);
    const availH = this.cssH - pad * 2 - gap * (ROWS - 1);
    const tile = Math.max(40, Math.min(availW / COLS, availH / ROWS));
    const gridW = tile * COLS + gap * (COLS - 1);
    const gridH = tile * ROWS + gap * (ROWS - 1);
    const ox = (this.cssW - gridW) / 2;
    const oy = (this.cssH - gridH) / 2;

    this.rects = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.rects.push({
          x: ox + c * (tile + gap),
          y: oy + r * (tile + gap),
          w: tile,
          h: tile,
        });
      }
    }
  }

  private pointerToIndex(e: MouseEvent): number {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  private handleClick(e: MouseEvent) {
    const i = this.pointerToIndex(e);
    if (i >= 0) this.onTileClick(i);
  }

  private handleMove(e: MouseEvent) {
    const i = this.pointerToIndex(e);
    this.hovered = i;
    this.canvas.style.cursor = i >= 0 ? "pointer" : "default";
  }

  private handleLeave() {
    this.hovered = -1;
    this.canvas.style.cursor = "default";
  }

  private loop() {
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  }

  private draw() {
    const { ctx } = this;
    const w = this.cssW;
    const h = this.cssH;
    ctx.clearRect(0, 0, w, h);

    // Grassy background.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#3f8a44");
    bg.addColorStop(1, "#2c6a33");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const state = gameStore.getState();
    const now = Date.now();
    const unlockedCount = state.plots.filter((p) => p.unlocked).length;
    const nextPlotPrice = plotPrice(unlockedCount);

    for (let i = 0; i < this.rects.length; i++) {
      this.drawPlot(
        this.rects[i],
        state.plots[i],
        now,
        nextPlotPrice,
        i === this.hovered,
      );
    }
  }

  private roundRect(r: Rect, radius: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  }

  private drawPlot(
    r: Rect,
    plot: Plot,
    now: number,
    nextPlotPrice: number,
    hovered: boolean,
  ) {
    const { ctx } = this;
    const radius = Math.min(16, r.w * 0.14);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    ctx.save();

    if (!plot.unlocked) {
      // Locked / overgrown land.
      this.roundRect(r, radius);
      ctx.fillStyle = hovered ? "#283820" : "#22301b";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${r.h * 0.3}px ${EMOJI_FONT}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText("🔒", cx, cy - r.h * 0.08);
      ctx.globalAlpha = 1;

      ctx.font = `600 ${Math.max(11, r.h * 0.12)}px ${UI_FONT}`;
      ctx.fillStyle = "#e8d27a";
      ctx.fillText(`$${nextPlotPrice}`, cx, cy + r.h * 0.24);
      ctx.restore();
      return;
    }

    // Soil tile.
    this.roundRect(r, radius);
    const soil = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    soil.addColorStop(0, hovered ? "#7a5840" : "#6e4d36");
    soil.addColorStop(1, "#5a3d29");
    ctx.fillStyle = soil;
    ctx.fill();

    // Furrow lines.
    ctx.save();
    this.roundRect(r, radius);
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2;
    const furrows = 4;
    for (let f = 1; f < furrows; f++) {
      const yy = r.y + (r.h / furrows) * f;
      ctx.beginPath();
      ctx.moveTo(r.x, yy);
      ctx.lineTo(r.x + r.w, yy);
      ctx.stroke();
    }
    ctx.restore();

    // Rim highlight.
    this.roundRect(r, radius);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    if (plot.crop != null) {
      const def = CROPS[plot.crop];
      const p = plantProgress(plot, now);
      const ready = isReady(plot, now);

      // Crop emoji grows as it matures.
      const size = r.h * (0.32 + 0.4 * p);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${size}px ${EMOJI_FONT}`;
      ctx.globalAlpha = 0.45 + 0.55 * p;

      if (ready) {
        const pulse = 8 + 6 * Math.sin(now / 280);
        ctx.shadowColor = "rgba(120,255,140,0.9)";
        ctx.shadowBlur = pulse;
      }
      ctx.fillText(def.emoji, cx, cy - r.h * 0.04);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (ready) {
        // READY pill.
        const pw = r.w * 0.62;
        const ph = Math.max(16, r.h * 0.18);
        const px = cx - pw / 2;
        const py = r.y + r.h - ph - r.h * 0.08;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, ph / 2);
        ctx.fillStyle = "#2fbf52";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.max(10, ph * 0.6)}px ${UI_FONT}`;
        ctx.textBaseline = "middle";
        ctx.fillText("READY", cx, py + ph / 2 + 0.5);
      } else {
        // Progress bar + remaining time.
        const grow = def.growSeconds;
        const remaining = grow * (1 - p);
        const bw = r.w * 0.72;
        const bh = Math.max(6, r.h * 0.07);
        const bx = cx - bw / 2;
        const by = r.y + r.h - bh - r.h * 0.12;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(bx, by, bw * p, bh, bh / 2);
        ctx.fillStyle = def.color;
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `600 ${Math.max(10, r.h * 0.12)}px ${UI_FONT}`;
        ctx.textBaseline = "bottom";
        ctx.fillText(fmtTime(remaining), cx, by - 3);
      }
    } else if (hovered) {
      // Empty + hovered: show a faint plant hint.
      ctx.globalAlpha = 0.4;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${r.h * 0.26}px ${EMOJI_FONT}`;
      ctx.fillText(CROPS[gameStore.getState().selectedCrop].emoji, cx, cy);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
