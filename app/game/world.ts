"use client";

/**
 * Isometric world model: projection, the farm-island layout, and decorations.
 * Tiles use a 2:1 diamond. The "field" is the block of tillable plots; the rest
 * of the island is grass with a pond, a farmhouse, a barn and trees.
 */
export const TILE_W = 80;
export const TILE_H = 40;
export const TILE_THICK = 8; // little vertical side on each ground tile (2.5D)
/** Buildings/decor scale by this so they stay proportional to bigger tiles. */
export const WORLD_SCALE = TILE_W / 64;

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

/** Dirt path from the farmhouse to the field gate. */
const PATH = new Set(["-2,5", "-1,5", "-1,4"]);
export function isPath(x: number, y: number): boolean {
  return PATH.has(`${x},${y}`);
}

export type FenceSide = "N" | "W" | "S" | "E";
export interface FenceSeg {
  x: number;
  y: number;
  side: FenceSide;
}

/** Fence around the field perimeter, with a gate at the path entrance. */
export function fenceSegments(): FenceSeg[] {
  const segs: FenceSeg[] = [];
  for (let x = FIELD_OX; x < FIELD_OX + FIELD_W; x++) {
    segs.push({ x, y: FIELD_OY, side: "N" });
    segs.push({ x, y: FIELD_OY + FIELD_H - 1, side: "S" });
  }
  for (let y = FIELD_OY; y < FIELD_OY + FIELD_H; y++) {
    segs.push({ x: FIELD_OX, y, side: "W" });
    segs.push({ x: FIELD_OX + FIELD_W - 1, y, side: "E" });
  }
  // Gate where the path meets the field.
  return segs.filter(
    (s) => !(s.side === "W" && s.x === FIELD_OX && s.y === FIELD_OY + FIELD_H - 1),
  );
}

/** Area (tile-space rect) where chickens wander, south of the field. */
export const CHICKEN_ZONE = { minX: -1, maxX: 4.5, minY: 5, maxY: 6.5 };

export function isIsland(x: number, y: number): boolean {
  return (
    x >= ISLAND_MIN_X &&
    x <= ISLAND_MAX_X &&
    y >= ISLAND_MIN_Y &&
    y <= ISLAND_MAX_Y
  );
}

export type DecorType =
  | "tree"
  | "house"
  | "barn"
  | "windmill"
  | "rock"
  | "flower"
  | "lab"
  | "lab2";
export interface Decor {
  type: DecorType;
  x: number;
  y: number;
}

export const DECOR: Decor[] = [
  { type: "house", x: -3, y: 5 },
  { type: "barn", x: -3, y: 2 },
  // The small lab sits off to the east, a little away from the village.
  { type: "lab", x: 7, y: 4 },
  // The big Synthetic Lab is tucked up north, hidden in a grove of trees.
  { type: "lab2", x: 2, y: -5 },
  { type: "windmill", x: 5, y: -1 },
  { type: "rock", x: -2, y: -2 },
  { type: "flower", x: 2, y: 5 },
  { type: "flower", x: 0, y: 6 },
  { type: "flower", x: 5, y: 5 },
  { type: "flower", x: -2, y: 3 },
  { type: "flower", x: 6, y: 0 },
  // grove hiding the Synthetic Lab
  { type: "tree", x: 0, y: -5 },
  { type: "tree", x: 4, y: -5 },
  { type: "tree", x: 0, y: -4 },
  { type: "tree", x: 4, y: -4 },
  { type: "tree", x: 1, y: -6 },
  { type: "tree", x: 3, y: -6 },
  { type: "tree", x: 2, y: -7 },
  { type: "tree", x: -1, y: -4 },
  { type: "tree", x: 5, y: -4 },
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
  { type: "tree", x: 7, y: 7 },
  { type: "tree", x: -1, y: 7 },
  { type: "tree", x: 1, y: 7 },
  { type: "tree", x: 3, y: 7 },
  { type: "tree", x: 5, y: 7 },
];

/** All decor positions (so procedural scenery never spawns on a building). */
export const DECOR_TILES = new Set(DECOR.map((d) => `${d.x},${d.y}`));
/** Fixed decor trees, by tile key. */
export const DECOR_TREES = new Set(
  DECOR.filter((d) => d.type === "tree").map((d) => `${d.x},${d.y}`),
);

export interface Camera {
  /** World tile the camera is centered on. */
  lookX: number;
  lookY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 3.6;

/** How far (in tiles) the camera may roam beyond the farm bounds. */
export const WORLD_PAN = 16;

/**
 * Chebyshev distance from a tile to the farm area (0 = inside the farm
 * grounds). Drives the procedural countryside: strays → groves → deep forest.
 */
export function farmDistance(x: number, y: number): number {
  const dx = x < ISLAND_MIN_X ? ISLAND_MIN_X - x : x > ISLAND_MAX_X ? x - ISLAND_MAX_X : 0;
  const dy = y < ISLAND_MIN_Y ? ISLAND_MIN_Y - y : y > ISLAND_MAX_Y ? y - ISLAND_MAX_Y : 0;
  return Math.max(dx, dy);
}

/** Deterministic per-tile hash for scenery + texture variation. */
export function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ ((x + 91) * (y + 47) * 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/** Procedural countryside beyond the farm: strays → groves → deep forest. */
export function proceduralDecor(
  x: number,
  y: number,
): "tree" | "flower" | "rock" | null {
  const d = farmDistance(x, y);
  if (d <= 0) return null;
  if (DECOR_TILES.has(`${x},${y}`)) return null;
  const hsh = tileHash(x, y);
  const tree = d >= 6 ? hsh % 4 !== 0 : d >= 3 ? hsh % 5 === 0 : hsh % 11 === 0;
  if (tree) return "tree";
  if (hsh % 17 === 3) return "flower";
  if (hsh % 29 === 7) return "rock";
  return null;
}

/** Is there a tree (fixed or procedural) at this tile? */
export function treeAt(x: number, y: number): boolean {
  return DECOR_TREES.has(`${x},${y}`) || proceduralDecor(x, y) === "tree";
}

/** How far out (from the farm) trees can be chopped for cash. */
export const CHOP_RADIUS = 3;

export function isChoppable(
  x: number,
  y: number,
  chopped: Set<string>,
): boolean {
  return (
    farmDistance(x, y) <= CHOP_RADIUS &&
    !chopped.has(`${x},${y}`) &&
    treeAt(x, y)
  );
}

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
