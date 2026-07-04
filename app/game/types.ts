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

export interface Planting {
  crop: CropId;
  /** Epoch ms when planted. */
  plantedAt: number;
  /** Randomized grow time in seconds for this specific plant. */
  grow: number;
}

export interface Plot {
  unlocked: boolean;
  /** Up to MAX_PLANTS growing independently in this tile. */
  plants: Planting[];
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
  | "meth"
  | "fentanyl"
  // buyable reagents
  | "sulfuric_acid"
  | "gasoline"
  | "acetic_anhydride"
  | "precursor";

export type StationId =
  | "incubator"
  | "cocaine"
  | "synthesis"
  | "meth"
  | "fentanyl";

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
  lab2Unlocked?: boolean;
  choppedTrees?: string[];
  /** Has the player seen Chikkie's welcome intro? Absent on old saves. */
  welcomed?: boolean;
  /** Seeds owned per crop. Seeds can't be bought — they're found/won. */
  seeds?: Partial<Record<CropId, number>>;
  /** In-game USDC (from cashing out fent/meth grams). Withdrawable. */
  usdc?: number;
  /** Player's payout wallet address. */
  withdrawWallet?: string;
  /** Pending/paid withdrawal requests. */
  withdrawals?: Withdrawal[];
  /** The tree currently being chopped, if any. */
  chopJob?: ChopJob | null;
}

/** The single in-progress tree chop (only one at a time). */
export interface ChopJob {
  x: number;
  y: number;
  startedAt: number;
}

export interface Withdrawal {
  id: number;
  /** USDC amount requested. */
  amount: number;
  wallet: string;
  at: number;
  status: "pending" | "paid" | "rejected";
  /** On-chain tx signature once paid (set by the operator). */
  txid?: string;
}
