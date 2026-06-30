"use client";

import { CropId } from "./types";

/**
 * Each crop has a hand-made vector icon at public/sprites/<cropId>.svg
 * (tobacco, khat, cannabis, shrooms, coca, poppy). They are drawn on the farm
 * board and shown in the HUD. To replace one, edit/overwrite its .svg — a crop
 * whose file fails to load falls back to its emoji automatically.
 */
export const SPRITE_DIR = "/sprites";

export function cropSpriteUrl(id: CropId): string {
  return `${SPRITE_DIR}/${id}.svg`;
}
