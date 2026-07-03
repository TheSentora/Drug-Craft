export type CropId =
  | "tobacco"
  | "khat"
  | "cannabis"
  | "shrooms"
  | "coca"
  | "poppy";

export interface CropDef {
  id: CropId;
  name: string;
  emoji: string;
  /** Cost in cash to plant one seed. */
  seedCost: number;
  /** Real-time seconds from planting to ready-to-harvest. */
  growSeconds: number;
  /** Cash earned when selling one harvested unit. */
  sellPrice: number;
  /** XP earned per harvest. */
  xp: number;
  /** Player level required before this crop can be planted. */
  unlockLevel: number;
  /** Tile / UI accent colour. */
  color: string;
}

export interface Plot {
  unlocked: boolean;
  crop: CropId | null;
  /** Epoch ms when the current crop was planted. */
  plantedAt: number | null;
}

export type MessageKind = "info" | "good" | "bad";

// ---- Lab / production -----------------------------------------------------

export type ProductId =
  // extracted intermediates
  | "cannabis_buds"
  | "coca_leaves"
  | "tobacco_leaves"
  | "morphine"
  | "codeine"
  // refined products
  | "dried_cannabis"
  | "dried_tobacco"
  | "cocaine"
  | "heroin"
  // buyable reagents
  | "sulfuric_acid"
  | "gasoline"
  | "acetic_anhydride";

export type StationId = "incubator" | "cocaine" | "synthesis";

/** A running processing job at a lab station. */
export interface LabJob {
  id: number;
  station: StationId;
  recipeId: string;
  /** Epoch ms when the job started. */
  startedAt: number;
}

export interface OrderItem {
  crop: CropId;
  qty: number;
}

/** A customer order: deliver the items, earn bonus cash + XP. */
export interface Order {
  id: number;
  items: OrderItem[];
  cash: number;
  xp: number;
}

export interface SaveData {
  v: number;
  cash: number;
  xp: number;
  plots: Plot[];
  inventory: Partial<Record<CropId, number>>;
  selectedCrop: CropId;
  lastSeen: number;
  orders?: Order[];
  products?: Partial<Record<ProductId, number>>;
  jobs?: LabJob[];
}
