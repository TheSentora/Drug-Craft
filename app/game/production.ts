import { CropId, ProductId, StationId } from "./types";

/**
 * Lab production model — a Hay Day-style crafting economy.
 *
 * This is deliberately an ABSTRACT game economy: an input item goes into a
 * station, a real-time timer runs, and a more valuable output item comes out.
 * The reagents and product names are satirical flavor (in the spirit of games
 * like Weedcraft Inc / Drug Dealer Simulator). There are intentionally no
 * real-world chemical procedures, quantities, or conditions anywhere here.
 */

export interface ProductDef {
  id: ProductId;
  name: string;
  emoji: string;
  kind: "intermediate" | "refined" | "reagent";
  /** Cash gained per unit when sold (0 = not directly sellable). */
  sellPrice: number;
  /** Cash cost per unit at the reagent shop (reagents only). */
  buyPrice?: number;
  /** Accent colour for UI chips. */
  color: string;
}

export const PRODUCTS: Record<ProductId, ProductDef> = {
  // ---- extracted intermediates ----
  cannabis_buds: {
    id: "cannabis_buds",
    name: "Cannabis Buds",
    emoji: "🌾",
    kind: "intermediate",
    sellPrice: 40,
    color: "#4caf50",
  },
  coca_leaves: {
    id: "coca_leaves",
    name: "Coca Leaves",
    emoji: "🍃",
    kind: "intermediate",
    sellPrice: 120,
    color: "#8bc34a",
  },
  tobacco_leaves: {
    id: "tobacco_leaves",
    name: "Tobacco Leaves",
    emoji: "🍂",
    kind: "intermediate",
    sellPrice: 6,
    color: "#caa472",
  },
  morphine: {
    id: "morphine",
    name: "Morphine",
    emoji: "💠",
    kind: "intermediate",
    sellPrice: 420,
    color: "#7e8dd6",
  },
  codeine: {
    id: "codeine",
    name: "Codeine",
    emoji: "🔷",
    kind: "intermediate",
    sellPrice: 300,
    color: "#5fa8d6",
  },
  // ---- refined products ----
  dried_cannabis: {
    id: "dried_cannabis",
    name: "Dried Cannabis",
    emoji: "🥦",
    kind: "refined",
    sellPrice: 260,
    color: "#3f9142",
  },
  dried_tobacco: {
    id: "dried_tobacco",
    name: "Dried Tobacco",
    emoji: "🚬",
    kind: "refined",
    sellPrice: 45,
    color: "#b98a52",
  },
  cocaine: {
    id: "cocaine",
    name: "Cocaine Powder",
    emoji: "❄️",
    kind: "refined",
    sellPrice: 1450,
    color: "#e8f0ff",
  },
  heroin: {
    id: "heroin",
    name: "Heroin",
    emoji: "🤎",
    kind: "refined",
    sellPrice: 2600,
    color: "#8a5a3a",
  },
  meth: {
    id: "meth",
    name: "Crystal Meth",
    emoji: "🧊",
    kind: "refined",
    sellPrice: 3800,
    color: "#8fd8f0",
  },
  fentanyl: {
    id: "fentanyl",
    name: "Fentanyl",
    emoji: "☠️",
    kind: "refined",
    sellPrice: 6500,
    color: "#e07a8a",
  },
  // ---- buyable reagents ----
  sulfuric_acid: {
    id: "sulfuric_acid",
    name: "Sulfuric Acid",
    emoji: "🧪",
    kind: "reagent",
    sellPrice: 0,
    buyPrice: 70,
    color: "#d7c34a",
  },
  gasoline: {
    id: "gasoline",
    name: "Gasoline",
    emoji: "⛽",
    kind: "reagent",
    sellPrice: 0,
    buyPrice: 45,
    color: "#c46b3a",
  },
  acetic_anhydride: {
    id: "acetic_anhydride",
    name: "Acetic Anhydride",
    emoji: "⚗️",
    kind: "reagent",
    sellPrice: 0,
    buyPrice: 130,
    color: "#8ad0d0",
  },
  precursor: {
    id: "precursor",
    name: "Precursor Kit",
    emoji: "🧰",
    kind: "reagent",
    sellPrice: 0,
    buyPrice: 220,
    color: "#c9b0e8",
  },
};

export const REAGENTS: ProductDef[] = Object.values(PRODUCTS).filter(
  (p) => p.kind === "reagent",
);

/** Instant extraction: turn one harvested crop into intermediate(s). */
export interface Extraction {
  id: string;
  crop: CropId;
  label: string;
  outputs: { product: ProductId; qty: number }[];
  xp: number;
}

export const EXTRACTIONS: Extraction[] = [
  {
    id: "extract_cannabis",
    crop: "cannabis",
    label: "Trim buds",
    outputs: [{ product: "cannabis_buds", qty: 1 }],
    xp: 3,
  },
  {
    id: "extract_coca",
    crop: "coca",
    label: "Strip leaves",
    outputs: [{ product: "coca_leaves", qty: 1 }],
    xp: 4,
  },
  {
    id: "extract_tobacco",
    crop: "tobacco",
    label: "Strip leaves",
    outputs: [{ product: "tobacco_leaves", qty: 1 }],
    xp: 1,
  },
  {
    id: "extract_poppy",
    crop: "poppy",
    // poppy yields both opiate intermediates at once
    label: "Extract alkaloids",
    outputs: [
      { product: "morphine", qty: 1 },
      { product: "codeine", qty: 1 },
    ],
    xp: 8,
  },
];

/** A timed processing recipe run at a station. */
export interface Recipe {
  id: string;
  station: StationId;
  name: string;
  inputs: { product: ProductId; qty: number }[];
  output: { product: ProductId; qty: number };
  hours: number;
  xp: number;
  unlockLevel: number;
}

export const RECIPES: Recipe[] = [
  {
    id: "dry_cannabis",
    station: "incubator",
    name: "Dry Cannabis",
    inputs: [{ product: "cannabis_buds", qty: 2 }],
    output: { product: "dried_cannabis", qty: 1 },
    hours: 10,
    xp: 30,
    unlockLevel: 2,
  },
  {
    id: "dry_tobacco",
    station: "incubator",
    name: "Dry Tobacco",
    inputs: [{ product: "tobacco_leaves", qty: 3 }],
    output: { product: "dried_tobacco", qty: 1 },
    hours: 6,
    xp: 12,
    unlockLevel: 1,
  },
  {
    id: "make_cocaine",
    station: "cocaine",
    name: "Refine Cocaine",
    inputs: [
      { product: "coca_leaves", qty: 3 },
      { product: "sulfuric_acid", qty: 1 },
      { product: "gasoline", qty: 1 },
    ],
    output: { product: "cocaine", qty: 1 },
    hours: 12,
    xp: 90,
    unlockLevel: 4,
  },
  {
    id: "make_heroin",
    station: "synthesis",
    name: "Synthesize Heroin",
    inputs: [
      { product: "morphine", qty: 2 },
      { product: "acetic_anhydride", qty: 1 },
    ],
    output: { product: "heroin", qty: 1 },
    hours: 10,
    xp: 140,
    unlockLevel: 6,
  },
  {
    id: "make_meth",
    station: "meth",
    name: "Cook Meth",
    inputs: [
      { product: "precursor", qty: 2 },
      { product: "sulfuric_acid", qty: 1 },
    ],
    output: { product: "meth", qty: 1 },
    hours: 8,
    xp: 220,
    unlockLevel: 10,
  },
  {
    id: "make_fentanyl",
    station: "fentanyl",
    name: "Make Fentanyl",
    inputs: [
      { product: "precursor", qty: 2 },
      { product: "acetic_anhydride", qty: 2 },
    ],
    output: { product: "fentanyl", qty: 1 },
    hours: 14,
    xp: 400,
    unlockLevel: 12,
  },
];

export interface StationDef {
  id: StationId;
  name: string;
  emoji: string;
  color: string;
  /** Which lab building this station lives in. */
  lab: 1 | 2;
}

export const STATIONS: StationDef[] = [
  { id: "incubator", name: "Drying Incubator", emoji: "🌡️", color: "#e0a54a", lab: 1 },
  { id: "cocaine", name: "Refinery", emoji: "🧫", color: "#7fb0e6", lab: 1 },
  { id: "synthesis", name: "Synthesis Bench", emoji: "⚗️", color: "#b98ad6", lab: 1 },
  { id: "meth", name: "Meth Lab", emoji: "🧊", color: "#8fd8f0", lab: 2 },
  { id: "fentanyl", name: "Fentanyl Bench", emoji: "☠️", color: "#e07a8a", lab: 2 },
];

export const RECIPES_BY_STATION: Record<StationId, Recipe[]> = {
  incubator: RECIPES.filter((r) => r.station === "incubator"),
  cocaine: RECIPES.filter((r) => r.station === "cocaine"),
  synthesis: RECIPES.filter((r) => r.station === "synthesis"),
  meth: RECIPES.filter((r) => r.station === "meth"),
  fentanyl: RECIPES.filter((r) => r.station === "fentanyl"),
};

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function extractionForCrop(crop: CropId): Extraction | undefined {
  return EXTRACTIONS.find((e) => e.crop === crop);
}

/** Job duration in ms. */
export function recipeDuration(r: Recipe): number {
  return r.hours * 3600 * 1000;
}
