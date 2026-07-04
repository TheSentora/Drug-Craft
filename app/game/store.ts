"use client";

import { CROPS, CROP_LIST } from "./crops";
import { levelForXp } from "./levels";
import {
  PRODUCTS,
  Recipe,
  USDC_PER_GRAM,
  extractionForCrop,
  isGramProduct,
  recipeById,
  recipeDuration,
} from "./production";
import { sfx } from "./sfx";
import {
  ChopJob,
  CropId,
  LabJob,
  MessageKind,
  Order,
  Planting,
  Plot,
  ProductId,
  SaveData,
  StationId,
  Withdrawal,
} from "./types";
import { FIELD_H, FIELD_W, isChoppable } from "./world";

/** How many jobs can run at once per station. */
export const STATION_SLOTS: Record<StationId, number> = {
  incubator: 4,
  cocaine: 3,
  synthesis: 3,
  meth: 2,
  fentanyl: 2,
};

/** Cash cost to finish a running job immediately (scales with time left). */
export function finishNowCost(job: LabJob, now: number): number {
  const r = recipeById(job.recipeId);
  if (!r) return 0;
  const msLeft = Math.max(0, recipeDuration(r) - (now - job.startedAt));
  const minsLeft = msLeft / 60000;
  return Math.max(5, Math.ceil(minsLeft * 1.5));
}

/** Requirements to unlock the second (Synthetic) lab. */
export const LAB2_UNLOCK_LEVEL = 10;
export const LAB2_COST = 25000;

/** What Chikkie's welcome chest can pay out. */
export type WelcomeReward =
  | { kind: "seeds"; crop: CropId; qty: number; label: string }
  | { kind: "product"; id: ProductId; qty: number; label: string };

export function jobProgress(job: LabJob, now: number): number {
  const r = recipeById(job.recipeId);
  if (!r) return 1;
  return Math.min(1, (now - job.startedAt) / recipeDuration(r));
}

export function jobReady(job: LabJob, now: number): boolean {
  return jobProgress(job, now) >= 1;
}

// ---- Board / economy constants -------------------------------------------

export const TOTAL_PLOTS = FIELD_W * FIELD_H;
const INITIAL_UNLOCKED = 9;
const START_CASH = 200;
const SAVE_VERSION = 2;
const SAVE_KEY = "drugcraft:save:v2";
const ORDER_COUNT = 3;

/** Price to unlock the next plot, given how many are already unlocked. */
export function plotPrice(unlockedCount: number): number {
  const bought = Math.max(0, unlockedCount - INITIAL_UNLOCKED);
  return Math.floor(100 * Math.pow(1.6, bought));
}

/** Up to this many plants can grow in one tile, at independent rates. */
export const MAX_PLANTS = 3;
const GROW_MIN_FACTOR = 0.66;
const GROW_MAX_FACTOR = 1.6;

/** The est. grow-time range (seconds) shown for a crop. */
export function growRange(baseSeconds: number): [number, number] {
  return [
    Math.round(baseSeconds * GROW_MIN_FACTOR),
    Math.round(baseSeconds * GROW_MAX_FACTOR),
  ];
}

function randGrow(baseSeconds: number): number {
  return Math.round(
    baseSeconds * (GROW_MIN_FACTOR + Math.random() * (GROW_MAX_FACTOR - GROW_MIN_FACTOR)),
  );
}

/** 0..1 growth of a single planting. */
export function plantingProgress(pl: Planting, now: number): number {
  return Math.min(1, (now - pl.plantedAt) / (pl.grow * 1000));
}

export function plantingReady(pl: Planting, now: number): boolean {
  return plantingProgress(pl, now) >= 1;
}

/** How many plants in this plot are ready to harvest. */
export function plotReadyCount(plot: Plot, now: number): number {
  return plot.plants.reduce((n, pl) => n + (plantingReady(pl, now) ? 1 : 0), 0);
}

/** Round to 2 decimals (money / grams). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Grams shown with up to 3 decimals, trimmed. */
export function fmtGrams(g: number): string {
  return `${round3(g)}g`;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---- Orders ----------------------------------------------------------------

let orderSeq = 1;

function genOrder(level: number): Order {
  const pool = CROP_LIST.filter((c) => c.unlockLevel <= level);
  const maxItems = Math.min(pool.length, level >= 4 ? 3 : level >= 2 ? 2 : 1);
  const nItems = 1 + Math.floor(Math.random() * maxItems);
  const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, nItems);
  const items = picked.map((c) => ({
    crop: c.id,
    qty: 2 + Math.floor(Math.random() * (2 + Math.min(4, level))),
  }));
  const base = items.reduce((s, it) => s + CROPS[it.crop].sellPrice * it.qty, 0);
  const xpBase = items.reduce((s, it) => s + CROPS[it.crop].xp * it.qty, 0);
  return {
    id: orderSeq++,
    items,
    cash: Math.round(base * (1.3 + Math.random() * 0.3)),
    xp: Math.round(xpBase * 1.5) + level * 2,
  };
}

// ---- State ----------------------------------------------------------------

export interface GameMessage {
  text: string;
  kind: MessageKind;
  at: number;
}

/** Visual effect events for the renderer (sparkles, floating text). */
export interface FxEvent {
  kind: "sparkle" | "text" | "chop";
  plotIndex?: number;
  /** Alternative to plotIndex: an arbitrary world tile. */
  tx?: number;
  ty?: number;
  text?: string;
}

export interface GameState {
  cash: number;
  xp: number;
  plots: Plot[];
  inventory: Partial<Record<CropId, number>>;
  /** Seeds owned per crop — planting consumes one; they can't be bought. */
  seeds: Partial<Record<CropId, number>>;
  products: Partial<Record<ProductId, number>>;
  jobs: LabJob[];
  lab2Unlocked: boolean;
  choppedTrees: Set<string>;
  selectedCrop: CropId;
  orders: Order[];
  message: GameMessage | null;
  /** False for a fresh account until Chikkie's welcome intro is finished. */
  welcomed: boolean;
  /** In-game USDC balance (cashed out from fent/meth grams). */
  usdc: number;
  /** Saved payout wallet. */
  withdrawWallet: string;
  withdrawals: Withdrawal[];
  /** The single tree being chopped (only one at a time). */
  chopJob: ChopJob | null;
}

/** Minimum USDC that can be withdrawn at once. */
export const MIN_WITHDRAW = 10;

// ---- Tree chopping ---------------------------------------------------------

/** Cash to start chopping a tree. */
export const CHOP_COST = 50;
/** Real-time seconds to fell one tree. */
export const CHOP_SECONDS = 120;

/**
 * Seed drop weights — cheaper/common crops drop far more often than rare,
 * expensive ones. `max` caps the (small) random stack size for that crop.
 */
const CHOP_SEED_TABLE: Record<CropId, { weight: number; max: number }> = {
  tobacco: { weight: 42, max: 3 },
  khat: { weight: 26, max: 3 },
  cannabis: { weight: 16, max: 2 },
  shrooms: { weight: 9, max: 2 },
  coca: { weight: 5, max: 1 },
  poppy: { weight: 2, max: 1 },
};

function rollChopSeeds(): { crop: CropId; qty: number } {
  const entries = Object.entries(CHOP_SEED_TABLE) as [
    CropId,
    { weight: number; max: number },
  ][];
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [crop, v] of entries) {
    r -= v.weight;
    if (r <= 0) return { crop, qty: 1 + Math.floor(Math.random() * v.max) };
  }
  return { crop: "tobacco", qty: 1 };
}

export function chopProgress(job: ChopJob, now: number): number {
  return Math.min(1, (now - job.startedAt) / (CHOP_SECONDS * 1000));
}

export function chopReady(job: ChopJob, now: number): boolean {
  return chopProgress(job, now) >= 1;
}

function defaultState(): GameState {
  const plots: Plot[] = Array.from({ length: TOTAL_PLOTS }, (_, i) => ({
    unlocked: i < INITIAL_UNLOCKED,
    plants: [],
  }));
  return {
    cash: START_CASH,
    xp: 0,
    plots,
    inventory: {},
    seeds: {}, // players start with zero seeds
    products: {},
    jobs: [],
    lab2Unlocked: false,
    choppedTrees: new Set(),
    selectedCrop: "tobacco",
    orders: [],
    message: null,
    welcomed: false,
    usdc: 0,
    withdrawWallet: "",
    withdrawals: [],
    chopJob: null,
  };
}

let jobSeq = 1;

let state: GameState = defaultState();
let version = 0;
let initialized = false;
let fxQueue: FxEvent[] = [];
/** When true, the intro is being replayed (e.g. by an admin) — don't re-gift. */
let introReplay = false;

const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let messageTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  version++;
  for (const l of listeners) l();
}

function scheduleSave() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 350);
}

function changed() {
  notify();
  scheduleSave();
}

function setMessage(text: string, kind: MessageKind = "info") {
  state.message = { text, kind, at: Date.now() };
  if (kind === "bad") sfx.play("error");
  notify();
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    state.message = null;
    notify();
  }, 2600);
}

/** Add XP, announcing level-ups (each level pays a cash bonus). */
function addXp(n: number) {
  const before = levelForXp(state.xp);
  state.xp += n;
  const after = levelForXp(state.xp);
  if (after > before) {
    const bonus = after * 50;
    state.cash += bonus;
    setMessage(`⭐ Level ${after}! +$${bonus.toLocaleString()}`, "good");
    sfx.play("levelup");
  }
}

// ---- Persistence ----------------------------------------------------------

/** Optional listener (e.g. cloud sync) notified whenever we save. */
let onSavedHook: ((data: SaveData) => void) | null = null;

/** Serializable snapshot of the whole game. */
function buildSave(): SaveData {
  return {
    v: SAVE_VERSION,
    cash: state.cash,
    xp: state.xp,
    plots: state.plots,
    inventory: state.inventory,
    seeds: state.seeds,
    selectedCrop: state.selectedCrop,
    lastSeen: Date.now(),
    orders: state.orders,
    products: state.products,
    jobs: state.jobs,
    lab2Unlocked: state.lab2Unlocked,
    choppedTrees: Array.from(state.choppedTrees),
    welcomed: state.welcomed,
    usdc: state.usdc,
    withdrawWallet: state.withdrawWallet,
    withdrawals: state.withdrawals,
    chopJob: state.chopJob,
  };
}

function save() {
  if (typeof window === "undefined") return;
  const data = buildSave();
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / blocked — ignore */
  }
  onSavedHook?.(data);
}

function topUpOrders() {
  const level = levelForXp(state.xp);
  while (state.orders.length < ORDER_COUNT) state.orders.push(genOrder(level));
}

function welcomeBack() {
  const now = Date.now();
  const readyPlots = state.plots.filter((p) => plotReadyCount(p, now) > 0).length;
  const readyJobs = state.jobs.filter((j) => jobReady(j, now)).length;
  if (readyPlots > 0 || readyJobs > 0) {
    const bits: string[] = [];
    if (readyPlots > 0) bits.push(`${readyPlots} plot${readyPlots > 1 ? "s" : ""}`);
    if (readyJobs > 0) bits.push(`${readyJobs} batch${readyJobs > 1 ? "es" : ""}`);
    setMessage(`Welcome back! ${bits.join(" & ")} ready to collect.`, "good");
  }
}

/** Replace the whole game state from a SaveData (local or cloud). */
function applySave(data: SaveData) {
  const plots: Plot[] = Array.from({ length: TOTAL_PLOTS }, (_, i) => {
    const p = data.plots?.[i] as
      | (Partial<Plot> & { crop?: CropId | null; plantedAt?: number | null })
      | undefined;
    if (!p) return { unlocked: i < INITIAL_UNLOCKED, plants: [] };
    let plants: Planting[] = [];
    if (Array.isArray(p.plants)) {
      plants = p.plants
        .filter((q) => q && CROPS[q.crop] && typeof q.plantedAt === "number")
        .map((q) => ({
          crop: q.crop,
          plantedAt: q.plantedAt,
          grow: typeof q.grow === "number" ? q.grow : CROPS[q.crop].growSeconds,
        }));
    } else if (p.crop && CROPS[p.crop] && typeof p.plantedAt === "number") {
      // migrate old single-crop plots
      plants = [{ crop: p.crop, plantedAt: p.plantedAt, grow: CROPS[p.crop].growSeconds }];
    }
    return { unlocked: !!p.unlocked, plants };
  });
  const jobs = Array.isArray(data.jobs) ? data.jobs.filter(validJob) : [];
  state = {
    cash: Number.isFinite(data.cash) ? data.cash : START_CASH,
    xp: Number.isFinite(data.xp) ? data.xp : 0,
    plots,
    inventory: data.inventory ?? {},
    seeds: data.seeds ?? {},
    products: data.products ?? {},
    jobs,
    lab2Unlocked: !!data.lab2Unlocked,
    choppedTrees: new Set(Array.isArray(data.choppedTrees) ? data.choppedTrees : []),
    selectedCrop: CROPS[data.selectedCrop] ? data.selectedCrop : "tobacco",
    orders: Array.isArray(data.orders) ? data.orders.filter(validOrder) : [],
    message: null,
    // Old saves predate the intro → treat as already welcomed (no replay).
    welcomed: data.welcomed ?? true,
    usdc: Number.isFinite(data.usdc) ? (data.usdc as number) : 0,
    withdrawWallet: typeof data.withdrawWallet === "string" ? data.withdrawWallet : "",
    withdrawals: Array.isArray(data.withdrawals) ? data.withdrawals : [],
    chopJob:
      data.chopJob &&
      typeof data.chopJob.x === "number" &&
      typeof data.chopJob.y === "number" &&
      typeof data.chopJob.startedAt === "number"
        ? data.chopJob
        : null,
  };
  orderSeq = state.orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;
  jobSeq = state.jobs.reduce((m, j) => Math.max(m, j.id), 0) + 1;
  topUpOrders();
}

function load(): SaveData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.plots)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function validOrder(o: unknown): o is Order {
  const ord = o as Order;
  return (
    !!ord &&
    typeof ord.id === "number" &&
    Array.isArray(ord.items) &&
    ord.items.every((it) => CROPS[it.crop] && typeof it.qty === "number") &&
    typeof ord.cash === "number" &&
    typeof ord.xp === "number"
  );
}

function validJob(j: unknown): j is LabJob {
  const job = j as LabJob;
  return (
    !!job &&
    typeof job.id === "number" &&
    typeof job.startedAt === "number" &&
    !!recipeById(job.recipeId)
  );
}

function addProduct(id: ProductId, n: number) {
  state.products[id] = (state.products[id] ?? 0) + n;
}

function haveProduct(id: ProductId): number {
  return state.products[id] ?? 0;
}

// ---- Public store ---------------------------------------------------------

export const gameStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  getVersion(): number {
    return version;
  },
  getState(): GameState {
    return state;
  },

  /** Renderer polls this each frame; returns queued effects and clears them. */
  drainFx(): FxEvent[] {
    if (fxQueue.length === 0) return fxQueue;
    const out = fxQueue;
    fxQueue = [];
    return out;
  },

  /** Save immediately (e.g. when the tab is hidden). */
  flush() {
    save();
  },

  /** Load save once, on the client. */
  init() {
    if (initialized) return;
    initialized = true;
    const data = load();
    if (data) {
      applySave(data);
      welcomeBack();
    } else {
      topUpOrders();
    }
    notify();
  },

  /** Serializable snapshot (used by cloud sync). */
  snapshot(): SaveData {
    return buildSave();
  },

  /** The epoch-ms of the current save (for newest-wins conflict resolution). */
  lastSeen(): number {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem(SAVE_KEY) : null;
      return raw ? (JSON.parse(raw) as SaveData).lastSeen ?? 0 : 0;
    } catch {
      return 0;
    }
  },

  /** Apply a save loaded from the cloud, then persist it locally. */
  loadRemote(data: SaveData) {
    applySave(data);
    welcomeBack();
    notify();
    save();
  },

  /** Register a hook fired on every save (cloud sync pushes from here). */
  onSaved(cb: (data: SaveData) => void) {
    onSavedHook = cb;
  },

  setSelectedCrop(id: CropId) {
    state.selectedCrop = id;
    changed();
  },

  /** Finish Chikkie's welcome intro, granting the chest reward once. */
  completeWelcome(reward?: WelcomeReward) {
    if (state.welcomed) return;
    state.welcomed = true;
    // A replay (admin re-watching) shouldn't hand out the gift again.
    if (introReplay) {
      introReplay = false;
      changed();
      return;
    }
    if (reward) {
      if (reward.kind === "seeds") {
        state.seeds[reward.crop] = (state.seeds[reward.crop] ?? 0) + reward.qty;
      } else {
        addProduct(reward.id, reward.qty);
      }
      sfx.play("levelup");
      setMessage(`🎁 ${reward.qty}× ${reward.label} from Chikkie`, "good");
    }
    changed();
  },

  /** Re-show Chikkie's welcome intro (for testing / admin). No gift on replay. */
  replayWelcome() {
    introReplay = true;
    state.welcomed = false;
    notify();
  },

  /** Single entry point for clicking a plot on the board. */
  handlePlotClick(index: number) {
    const plot = state.plots[index];
    if (!plot) return;
    if (!plot.unlocked) return this.buyPlot(index);
    if (plotReadyCount(plot, Date.now()) > 0) return this.harvest(index);
    if (plot.plants.length < MAX_PLANTS) return this.plant(index);
    setMessage("Still growing…", "info");
  },

  buyPlot(index: number) {
    const plot = state.plots[index];
    if (!plot || plot.unlocked) return;
    const unlockedCount = state.plots.filter((p) => p.unlocked).length;
    const price = plotPrice(unlockedCount);
    if (state.cash < price) {
      setMessage(`Need $${price} to clear this land`, "bad");
      return;
    }
    state.cash -= price;
    plot.unlocked = true;
    setMessage(`New plot cleared! −$${price}`, "good");
    sfx.play("unlock");
    fxQueue.push({ kind: "sparkle", plotIndex: index });
    changed();
  },

  plant(index: number) {
    const plot = state.plots[index];
    if (!plot || !plot.unlocked || plot.plants.length >= MAX_PLANTS) return;
    const def = CROPS[state.selectedCrop];
    const level = levelForXp(state.xp);
    if (level < def.unlockLevel) {
      setMessage(`${def.name} unlocks at level ${def.unlockLevel}`, "bad");
      return;
    }
    const owned = state.seeds[def.id] ?? 0;
    if (owned <= 0) {
      setMessage(`No ${def.name} seeds`, "bad");
      return;
    }
    state.seeds[def.id] = owned - 1;
    plot.plants.push({
      crop: def.id,
      plantedAt: Date.now(),
      grow: randGrow(def.growSeconds),
    });
    sfx.play("plant");
    changed();
  },

  /** Harvest the ready plants in one plot (leaves any still growing). */
  harvest(index: number) {
    const plot = state.plots[index];
    if (!plot) return;
    const now = Date.now();
    let xp = 0;
    let count = 0;
    plot.plants = plot.plants.filter((pl) => {
      if (plantingReady(pl, now)) {
        const def = CROPS[pl.crop];
        state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
        xp += def.xp;
        count++;
        return false;
      }
      return true;
    });
    if (count === 0) return;
    sfx.play("harvest");
    fxQueue.push({ kind: "sparkle", plotIndex: index });
    fxQueue.push({ kind: "text", plotIndex: index, text: `+${xp} XP` });
    addXp(xp);
    changed();
  },

  /** Harvest every ready plant across all plots. */
  harvestAll() {
    const now = Date.now();
    let count = 0;
    let xp = 0;
    state.plots.forEach((plot, i) => {
      let plotHit = false;
      plot.plants = plot.plants.filter((pl) => {
        if (plantingReady(pl, now)) {
          const def = CROPS[pl.crop];
          state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
          xp += def.xp;
          count++;
          plotHit = true;
          return false;
        }
        return true;
      });
      if (plotHit) fxQueue.push({ kind: "sparkle", plotIndex: i });
    });
    if (count === 0) {
      setMessage("Nothing ready to harvest yet", "info");
      return;
    }
    sfx.play("harvest");
    setMessage(`Harvested ${count} plant${count > 1 ? "s" : ""} +${xp} XP`, "good");
    addXp(xp);
    changed();
  },

  sell(id: CropId, qty: number) {
    const have = state.inventory[id] ?? 0;
    const n = Math.min(qty, have);
    if (n <= 0) return;
    const def = CROPS[id];
    state.inventory[id] = have - n;
    state.cash += def.sellPrice * n;
    sfx.play("sell");
    changed();
  },

  sellAll() {
    let total = 0;
    for (const id of Object.keys(state.inventory) as CropId[]) {
      const n = state.inventory[id] ?? 0;
      if (n > 0) {
        total += CROPS[id].sellPrice * n;
        state.inventory[id] = 0;
      }
    }
    if (total <= 0) {
      setMessage("Nothing in the stash to sell", "info");
      return;
    }
    state.cash += total;
    sfx.play("sell");
    setMessage(`Sold everything for $${total.toLocaleString()}`, "good");
    changed();
  },

  canDeliver(order: Order): boolean {
    return order.items.every((it) => (state.inventory[it.crop] ?? 0) >= it.qty);
  },

  deliver(orderId: number) {
    const idx = state.orders.findIndex((o) => o.id === orderId);
    if (idx < 0) return;
    const order = state.orders[idx];
    if (!this.canDeliver(order)) {
      setMessage("Not enough crops for this order yet", "bad");
      return;
    }
    for (const it of order.items) {
      state.inventory[it.crop] = (state.inventory[it.crop] ?? 0) - it.qty;
    }
    state.cash += order.cash;
    setMessage(
      `📦 Order delivered! +$${order.cash.toLocaleString()} +${order.xp} XP`,
      "good",
    );
    sfx.play("order");
    addXp(order.xp);
    state.orders[idx] = genOrder(levelForXp(state.xp));
    changed();
  },

  /** Toss an order you don't like; a new one arrives. */
  rerollOrder(orderId: number) {
    const idx = state.orders.findIndex((o) => o.id === orderId);
    if (idx < 0) return;
    state.orders[idx] = genOrder(levelForXp(state.xp));
    setMessage("New order posted", "info");
    changed();
  },

  // ---- Lab: extraction, production, reagents, product sales --------------

  /** Instant: turn one harvested crop into its extracted intermediate(s). */
  extract(cropId: CropId) {
    const ex = extractionForCrop(cropId);
    if (!ex) return;
    if ((state.inventory[cropId] ?? 0) < 1) {
      setMessage(`No ${CROPS[cropId].name} to extract`, "bad");
      return;
    }
    state.inventory[cropId] = (state.inventory[cropId] ?? 0) - 1;
    for (const o of ex.outputs) addProduct(o.product, o.qty);
    sfx.play("harvest");
    const label = ex.outputs
      .map((o) => `${o.qty} ${PRODUCTS[o.product].name}`)
      .join(" + ");
    setMessage(`Extracted ${label}`, "good");
    addXp(ex.xp);
    changed();
  },

  extractAll(cropId: CropId) {
    const ex = extractionForCrop(cropId);
    if (!ex) return;
    let n = state.inventory[cropId] ?? 0;
    if (n < 1) {
      setMessage(`No ${CROPS[cropId].name} to extract`, "bad");
      return;
    }
    let xp = 0;
    while (n > 0) {
      n--;
      for (const o of ex.outputs) addProduct(o.product, o.qty);
      xp += ex.xp;
    }
    state.inventory[cropId] = 0;
    sfx.play("harvest");
    setMessage(`Extracted all ${CROPS[cropId].name}`, "good");
    addXp(xp);
    changed();
  },

  buyReagent(id: ProductId, qty = 1) {
    const def = PRODUCTS[id];
    if (!def || def.kind !== "reagent" || !def.buyPrice) return;
    const cost = def.buyPrice * qty;
    if (state.cash < cost) {
      setMessage(`Need $${cost} for ${def.name}`, "bad");
      return;
    }
    state.cash -= cost;
    addProduct(id, qty);
    sfx.play("sell");
    changed();
  },

  jobsAt(station: StationId): LabJob[] {
    return state.jobs.filter((j) => j.station === station);
  },

  canStart(recipe: Recipe): boolean {
    if (levelForXp(state.xp) < recipe.unlockLevel) return false;
    if (this.jobsAt(recipe.station).length >= STATION_SLOTS[recipe.station]) {
      return false;
    }
    return recipe.inputs.every((i) => haveProduct(i.product) >= i.qty);
  },

  startJob(recipeId: string) {
    const r = recipeById(recipeId);
    if (!r) return;
    if (levelForXp(state.xp) < r.unlockLevel) {
      setMessage(`Unlocks at level ${r.unlockLevel}`, "bad");
      return;
    }
    if (this.jobsAt(r.station).length >= STATION_SLOTS[r.station]) {
      setMessage("All slots busy", "bad");
      return;
    }
    const missing = r.inputs.find((i) => haveProduct(i.product) < i.qty);
    if (missing) {
      setMessage(`Need ${missing.qty} ${PRODUCTS[missing.product].name}`, "bad");
      return;
    }
    for (const i of r.inputs) state.products[i.product] = haveProduct(i.product) - i.qty;
    state.jobs.push({
      id: jobSeq++,
      station: r.station,
      recipeId: r.id,
      startedAt: Date.now(),
    });
    sfx.play("plant");
    setMessage(`${r.name} started`, "info");
    changed();
  },

  /** Pay cash to finish a running job instantly. */
  finishJobNow(jobId: number) {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const now = Date.now();
    if (jobReady(job, now)) return;
    const r0 = recipeById(job.recipeId);
    if (r0 && isGramProduct(r0.output.product)) {
      // Real-money products can't be rushed — they must be made the hard way.
      setMessage("This can't be rushed", "bad");
      return;
    }
    const cost = finishNowCost(job, now);
    if (state.cash < cost) {
      setMessage(`Need $${cost.toLocaleString()} to finish now`, "bad");
      return;
    }
    state.cash -= cost;
    const r = recipeById(job.recipeId);
    if (r) job.startedAt = now - recipeDuration(r);
    sfx.play("sell");
    changed();
  },

  collectJob(jobId: number) {
    const idx = state.jobs.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    const job = state.jobs[idx];
    if (!jobReady(job, Date.now())) return;
    const r = recipeById(job.recipeId);
    if (!r) {
      state.jobs.splice(idx, 1);
      changed();
      return;
    }
    addProduct(r.output.product, r.output.qty);
    state.jobs.splice(idx, 1);
    sfx.play("order");
    const amount = isGramProduct(r.output.product)
      ? fmtGrams(r.output.qty)
      : `${r.output.qty}`;
    setMessage(`Collected ${amount} ${PRODUCTS[r.output.product].name}`, "good");
    addXp(r.xp);
    changed();
  },

  collectAllJobs() {
    const now = Date.now();
    const ready = state.jobs.filter((j) => jobReady(j, now));
    if (ready.length === 0) {
      setMessage("Nothing finished yet", "info");
      return;
    }
    let xp = 0;
    for (const job of ready) {
      const r = recipeById(job.recipeId);
      if (r) {
        addProduct(r.output.product, r.output.qty);
        xp += r.xp;
      }
    }
    state.jobs = state.jobs.filter((j) => !jobReady(j, now));
    sfx.play("order");
    setMessage(`Collected ${ready.length} finished batch${ready.length > 1 ? "es" : ""}`, "good");
    addXp(xp);
    changed();
  },

  sellProduct(id: ProductId, qty: number) {
    const def = PRODUCTS[id];
    if (!def || def.sellPrice <= 0) return;
    const have = haveProduct(id);
    const n = Math.min(qty, have);
    if (n <= 0) return;
    state.products[id] = have - n;
    state.cash += def.sellPrice * n;
    sfx.play("sell");
    changed();
  },

  // ---- Cash-out: fent/meth grams -> in-game USDC -> withdrawal ------------

  /** Convert all grams of a gram-product into in-game USDC. */
  cashOut(id: ProductId) {
    const rate = USDC_PER_GRAM[id];
    if (!isGramProduct(id) || !rate) return;
    const grams = haveProduct(id);
    if (grams <= 0) {
      setMessage(`No ${PRODUCTS[id].name} to cash out`, "bad");
      return;
    }
    const usdc = grams * rate;
    state.products[id] = 0;
    state.usdc = round2(state.usdc + usdc);
    sfx.play("sell");
    setMessage(`Cashed out ${fmtGrams(grams)} → $${round2(usdc)} USDC`, "good");
    changed();
  },

  setWithdrawWallet(addr: string) {
    state.withdrawWallet = addr.trim();
    changed();
  },

  /** Queue a withdrawal of in-game USDC to the saved wallet (operator pays). */
  requestWithdrawal(amount: number) {
    const amt = round2(amount);
    if (!state.withdrawWallet) {
      setMessage("Enter a withdrawal wallet first", "bad");
      return;
    }
    if (!(amt >= MIN_WITHDRAW)) {
      setMessage(`Minimum withdrawal is $${MIN_WITHDRAW} USDC`, "bad");
      return;
    }
    if (amt > state.usdc) {
      setMessage("Not enough USDC", "bad");
      return;
    }
    state.usdc = round2(state.usdc - amt);
    state.withdrawals.unshift({
      id: Date.now(),
      amount: amt,
      wallet: state.withdrawWallet,
      at: Date.now(),
      status: "pending",
    });
    sfx.play("order");
    setMessage(`Withdrawal of $${amt} USDC requested`, "good");
    changed();
  },

  // ---- Chopping trees ----------------------------------------------------

  /** Route a click on a choppable tree: start / wait / collect. */
  handleTreeClick(x: number, y: number) {
    const job = state.chopJob;
    if (job) {
      if (job.x === x && job.y === y) {
        if (chopReady(job, Date.now())) return this.collectChop();
        setMessage("Still chopping…", "info");
      } else {
        setMessage("You can only chop one tree at a time", "bad");
      }
      return;
    }
    this.startChop(x, y);
  },

  /** Pay to begin felling a tree (takes CHOP_SECONDS). */
  startChop(x: number, y: number) {
    if (state.chopJob) return;
    if (!isChoppable(x, y, state.choppedTrees)) return;
    if (state.cash < CHOP_COST) {
      setMessage(`Need $${CHOP_COST} to chop a tree`, "bad");
      return;
    }
    state.cash -= CHOP_COST;
    state.chopJob = { x, y, startedAt: Date.now() };
    sfx.play("plant");
    setMessage(`Chopping a tree… −$${CHOP_COST}`, "info");
    changed();
  },

  /** Finish the current chop: fell the tree and drop random seeds. */
  collectChop() {
    const job = state.chopJob;
    if (!job || !chopReady(job, Date.now())) return;
    const { x, y } = job;
    state.chopJob = null;
    state.choppedTrees.add(`${x},${y}`);
    const drop = rollChopSeeds();
    state.seeds[drop.crop] = (state.seeds[drop.crop] ?? 0) + drop.qty;
    sfx.play("harvest");
    fxQueue.push({ kind: "chop", tx: x, ty: y });
    fxQueue.push({
      kind: "text",
      tx: x,
      ty: y,
      text: `+${drop.qty} ${CROPS[drop.crop].name} seed${drop.qty > 1 ? "s" : ""}`,
    });
    setMessage(
      `Tree down! +${drop.qty} ${CROPS[drop.crop].name} seed${drop.qty > 1 ? "s" : ""}`,
      "good",
    );
    addXp(4);
    changed();
  },

  // ---- Synthetic Lab (lab2) ----------------------------------------------

  unlockLab2() {
    if (state.lab2Unlocked) return;
    if (levelForXp(state.xp) < LAB2_UNLOCK_LEVEL) {
      setMessage(`Reach level ${LAB2_UNLOCK_LEVEL} to unlock the Synthetic Lab`, "bad");
      return;
    }
    if (state.cash < LAB2_COST) {
      setMessage(`Need $${LAB2_COST.toLocaleString()} to build the Synthetic Lab`, "bad");
      return;
    }
    state.cash -= LAB2_COST;
    state.lab2Unlocked = true;
    sfx.play("unlock");
    setMessage("🔬 Synthetic Lab unlocked!", "good");
    changed();
  },

  reset() {
    state = defaultState();
    state.welcomed = true; // a manual reset shouldn't replay the new-user intro
    const level = levelForXp(0);
    while (state.orders.length < ORDER_COUNT) state.orders.push(genOrder(level));
    jobSeq = 1;
    save();
    setMessage("Farm reset", "info");
    changed();
  },
};
