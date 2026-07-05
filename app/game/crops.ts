import { CropDef, CropId } from "./types";

/**
 * The crop catalog. Balanced so cheaper/faster crops have a lower margin and
 * premium crops take longer but pay out far more — classic Hay-Day style curve.
 */
export const CROPS: Record<CropId, CropDef> = {
  tobacco: {
    id: "tobacco",
    name: "Tobacco",
    emoji: "🚬",
    seedCost: 5,
    growSeconds: 20,
    sellPrice: 11,
    xp: 2,
    unlockLevel: 1,
    color: "#caa472",
  },
  khat: {
    id: "khat",
    name: "Khat",
    emoji: "☘️",
    seedCost: 14,
    growSeconds: 45,
    sellPrice: 33,
    xp: 5,
    unlockLevel: 1,
    color: "#6fbf4f",
  },
  cannabis: {
    id: "cannabis",
    name: "Cannabis",
    emoji: "🍁",
    seedCost: 30,
    growSeconds: 90,
    sellPrice: 78,
    xp: 9,
    unlockLevel: 1,
    color: "#4caf50",
  },
  shrooms: {
    id: "shrooms",
    name: "Shrooms",
    emoji: "🍄",
    seedCost: 55,
    growSeconds: 150,
    sellPrice: 150,
    xp: 15,
    unlockLevel: 3,
    color: "#c45b54",
  },
  coca: {
    id: "coca",
    name: "Coca",
    emoji: "🍃",
    seedCost: 110,
    growSeconds: 300,
    sellPrice: 330,
    xp: 26,
    unlockLevel: 4,
    color: "#8bc34a",
  },
  poppy: {
    id: "poppy",
    name: "Poppy",
    emoji: "🌺",
    seedCost: 240,
    growSeconds: 600,
    sellPrice: 770,
    xp: 50,
    unlockLevel: 1,
    color: "#e0577f",
  },
};

export const CROP_LIST: CropDef[] = Object.values(CROPS);

/** PNG seed-bag icons that replace the flat SVG for these crops. */
const SEED_ICON: Partial<Record<CropId, string>> = {
  tobacco: "/sprites/tobaccoseeds.png",
  cannabis: "/sprites/cannabisseeds.png",
  coca: "/sprites/cocaseeds.png",
  poppy: "/sprites/poppyseeds.png",
};

/** Icon URL for a crop/seed — the PNG seed bag if we have one, else the SVG. */
export function cropIconUrl(id: CropId): string {
  return SEED_ICON[id] ?? `/sprites/${id}.svg`;
}
