"use client";

/**
 * Isometric world model: projection, the farm-island layout, and decorations.
 * Tiles use a 2:1 diamond. The "field" is the block of tillable plots; the rest
 * of the island is grass with a pond, a farmhouse, a barn and trees.
 */
export const TILE_W = 64;
export const TILE_H = 32;
export const TILE_THICK = 7; // little vertical side on each ground tile (2.5D)

export const FIELD_W = 5;
export const FIELD_H = 5;
export const FIELD_OX = 0;
export const FIELD_OY = 0;

const MARGIN = 3;
export const ISLAND_MIN_X = FIELD_OX - MARGIN;
export const ISLAND_MAX_X = FIELD_OX + FIELD_W - 1 + MARGIN;
export const ISLAND_MIN_Y = FIELD_OY - MARGIN;
export const ISLAND_MAX_Y = FIELD_OY + FIELD_H - 1 + MARGIN;

export const FIELD_CENTER = {
  x: FIELD_OX + (FIELD_W - 1) / 2,
  y: FIELD_OY + (FIELD_H - 1) / 2,
};

export function isFieldTile(x: number, y: number): boolean {
  return (
    x >= FIELD_OX &&
    x < FIELD_OX + FIELD_W &&
    y >= FIELD_OY &&
    y < FIELD_OY + FIELD_H
  );
}

export function plotIndexAt(x: number, y: number): number {
  if (!isFieldTile(x, y)) return -1;
  return (y - FIELD_OY) * FIELD_W + (x - FIELD_OX);
}

export function plotTile(index: number): { x: number; y: number } {
  return {
    x: FIELD_OX + (index % FIELD_W),
    y: FIELD_OY + Math.floor(index / FIELD_W),
  };
}

const POND = new Set(["6,-3", "7,-3", "6,-2", "7,-2"]);
export function isPond(x: number, y: number): boolean {
  return POND.has(`${x},${y}`);
}

export function isIsland(x: number, y: number): boolean {
  return (
    x >= ISLAND_MIN_X &&
    x <= ISLAND_MAX_X &&
    y >= ISLAND_MIN_Y &&
    y <= ISLAND_MAX_Y
  );
}

export type DecorType = "tree" | "house" | "barn";
export interface Decor {
  type: DecorType;
  x: number;
  y: number;
}

export const DECOR: Decor[] = [
  { type: "house", x: -3, y: 5 },
  { type: "barn", x: -3, y: 2 },
  // trees around the perimeter (kept off the field & pond)
  { type: "tree", x: -3, y: -3 },
  { type: "tree", x: -1, y: -3 },
  { type: "tree", x: 1, y: -3 },
  { type: "tree", x: 3, y: -3 },
  { type: "tree", x: 5, y: -3 },
  { type: "tree", x: -3, y: -1 },
  { type: "tree", x: -3, y: 0 },
  { type: "tree", x: -3, y: 6 },
  { type: "tree", x: -3, y: 7 },
  { type: "tree", x: 7, y: -1 },
  { type: "tree", x: 7, y: 1 },
  { type: "tree", x: 7, y: 3 },
  { type: "tree", x: 7, y: 5 },
  { type: "tree", x: 7, y: 7 },
  { type: "tree", x: -1, y: 7 },
  { type: "tree", x: 1, y: 7 },
  { type: "tree", x: 3, y: 7 },
  { type: "tree", x: 5, y: 7 },
];

export interface Camera {
  /** World tile the camera is centered on. */
  lookX: number;
  lookY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.6;

export function tileToScreen(
  tx: number,
  ty: number,
  cam: Camera,
  cssW: number,
  cssH: number,
): [number, number] {
  const hw = (TILE_W / 2) * cam.zoom;
  const hh = (TILE_H / 2) * cam.zoom;
  const sx = cssW / 2 + (tx - ty - (cam.lookX - cam.lookY)) * hw;
  const sy = cssH / 2 + (tx + ty - (cam.lookX + cam.lookY)) * hh;
  return [sx, sy];
}

export function screenToTile(
  sx: number,
  sy: number,
  cam: Camera,
  cssW: number,
  cssH: number,
): { x: number; y: number } {
  const hw = (TILE_W / 2) * cam.zoom;
  const hh = (TILE_H / 2) * cam.zoom;
  const a = (sx - cssW / 2) / hw + (cam.lookX - cam.lookY); // tx - ty
  const b = (sy - cssH / 2) / hh + (cam.lookX + cam.lookY); // tx + ty
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Convert a screen-pixel pan delta into a change in the camera look point. */
export function panDelta(
  dxPix: number,
  dyPix: number,
  cam: Camera,
): { dLookX: number; dLookY: number } {
  const hw = (TILE_W / 2) * cam.zoom;
  const hh = (TILE_H / 2) * cam.zoom;
  const da = dxPix / hw; // change in (tx - ty)
  const db = dyPix / hh; // change in (tx + ty)
  return { dLookX: -(da + db) / 2, dLookY: -(db - da) / 2 };
}
