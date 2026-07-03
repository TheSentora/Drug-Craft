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

export interface StageArt {
  url: string;
  /** This stage is shown while growth progress ≤ upTo (0..1). */
  upTo: number;
}

/**
 * Crops with dedicated per-stage artwork (transparent PNGs). The renderer
 * prefers these over the single icon: young → mid → mature.
 */
export const CROP_STAGE_ART: Partial<Record<CropId, StageArt[]>> = {
  cannabis: [
    { url: `${SPRITE_DIR}/cannabis1.png`, upTo: 0.4 },
    { url: `${SPRITE_DIR}/cannabis2.png`, upTo: 0.75 },
    { url: `${SPRITE_DIR}/cannabis3.png`, upTo: 1 },
  ],
};
