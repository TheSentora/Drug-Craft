"use client";

import { CROPS, CROP_LIST } from "./crops";
import { levelForXp } from "./levels";
import {
  PRODUCTS,
  Recipe,
  extractionForCrop,
  recipeById,
  recipeDuration,
} from "./production";
import { sfx } from "./sfx";
import {
  CropId,
  LabJob,
  MessageKind,
  Order,
  Plot,
  ProductId,
  SaveData,
  StationId,
} from "./types";
import { FIELD_H, FIELD_W, chopReward, isChoppable } from "./world";

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

/** 0..1 growth progress of a plot at time `now`. */
export function plantProgress(plot: Plot, now: number): number {
  if (!plot.crop || plot.plantedAt == null) return 0;
  const grow = CROPS[plot.crop].growSeconds * 1000;
  return Math.min(1, (now - plot.plantedAt) / grow);
}

export function isReady(plot: Plot, now: number): boolean {
  return plot.crop != null && plantProgress(plot, now) >= 1;
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
  products: Partial<Record<ProductId, number>>;
  jobs: LabJob[];
  lab2Unlocked: boolean;
  choppedTrees: Set<string>;
  selectedCrop: CropId;
  orders: Order[];
  message: GameMessage | null;
}

function defaultState(): GameState {
  const plots: Plot[] = Array.from({ length: TOTAL_PLOTS }, (_, i) => ({
    unlocked: i < INITIAL_UNLOCKED,
    crop: null,
    plantedAt: null,
  }));
  return {
    cash: START_CASH,
    xp: 0,
    plots,
    inventory: {},
    products: {},
    jobs: [],
    lab2Unlocked: false,
    choppedTrees: new Set(),
    selectedCrop: "tobacco",
    orders: [],
    message: null,
  };
}

let jobSeq = 1;

let state: GameState = defaultState();
let version = 0;
let initialized = false;
let fxQueue: FxEvent[] = [];

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
    selectedCrop: state.selectedCrop,
    lastSeen: Date.now(),
    orders: state.orders,
    products: state.products,
    jobs: state.jobs,
    lab2Unlocked: state.lab2Unlocked,
    choppedTrees: Array.from(state.choppedTrees),
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
  const readyPlots = state.plots.filter((p) => isReady(p, now)).length;
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
    const p = data.plots?.[i];
    return p
      ? {
          unlocked: !!p.unlocked,
          crop: p.crop ?? null,
          plantedAt: p.plantedAt ?? null,
        }
      : { unlocked: i < INITIAL_UNLOCKED, crop: null, plantedAt: null };
  });
  const jobs = Array.isArray(data.jobs) ? data.jobs.filter(validJob) : [];
  state = {
    cash: Number.isFinite(data.cash) ? data.cash : START_CASH,
    xp: Number.isFinite(data.xp) ? data.xp : 0,
    plots,
    inventory: data.inventory ?? {},
    products: data.products ?? {},
    jobs,
    lab2Unlocked: !!data.lab2Unlocked,
    choppedTrees: new Set(Array.isArray(data.choppedTrees) ? data.choppedTrees : []),
    selectedCrop: CROPS[data.selectedCrop] ? data.selectedCrop : "tobacco",
    orders: Array.isArray(data.orders) ? data.orders.filter(validOrder) : [],
    message: null,
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

  /** Single entry point for clicking a plot on the board. */
  handlePlotClick(index: number) {
    const plot = state.plots[index];
    if (!plot) return;
    if (!plot.unlocked) return this.buyPlot(index);
    if (plot.crop == null) return this.plant(index);
    if (isReady(plot, Date.now())) return this.harvest(index);
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
    if (!plot || !plot.unlocked || plot.crop != null) return;
    const def = CROPS[state.selectedCrop];
    const level = levelForXp(state.xp);
    if (level < def.unlockLevel) {
      setMessage(`${def.name} unlocks at level ${def.unlockLevel}`, "bad");
      return;
    }
    if (state.cash < def.seedCost) {
      setMessage(`Not enough cash for ${def.name} seeds`, "bad");
      return;
    }
    state.cash -= def.seedCost;
    plot.crop = def.id;
    plot.plantedAt = Date.now();
    sfx.play("plant");
    changed();
  },

  harvest(index: number) {
    const plot = state.plots[index];
    if (!plot || plot.crop == null) return;
    if (!isReady(plot, Date.now())) return;
    const def = CROPS[plot.crop];
    state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
    plot.crop = null;
    plot.plantedAt = null;
    sfx.play("harvest");
    fxQueue.push({ kind: "sparkle", plotIndex: index });
    fxQueue.push({ kind: "text", plotIndex: index, text: `+${def.xp} XP` });
    addXp(def.xp);
    changed();
  },

  /** Harvest every ready plot at once. */
  harvestAll() {
    const now = Date.now();
    let count = 0;
    let xp = 0;
    state.plots.forEach((plot, i) => {
      if (plot.crop != null && isReady(plot, now)) {
        const def = CROPS[plot.crop];
        state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
        xp += def.xp;
        plot.crop = null;
        plot.plantedAt = null;
        fxQueue.push({ kind: "sparkle", plotIndex: i });
        count++;
      }
    });
    if (count === 0) {
      setMessage("Nothing ready to harvest yet", "info");
      return;
    }
    sfx.play("harvest");
    setMessage(`Harvested ${count} plot${count > 1 ? "s" : ""} +${xp} XP`, "good");
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
    setMessage(
      `Collected ${r.output.qty} ${PRODUCTS[r.output.product].name}`,
      "good",
    );
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

  // ---- Chopping trees ----------------------------------------------------

  chopTree(x: number, y: number) {
    if (!isChoppable(x, y, state.choppedTrees)) return;
    state.choppedTrees.add(`${x},${y}`);
    const reward = chopReward(x, y);
    state.cash += reward;
    sfx.play("unlock");
    fxQueue.push({ kind: "chop", tx: x, ty: y });
    fxQueue.push({ kind: "text", tx: x, ty: y, text: `+$${reward}` });
    setMessage(`Cleared a tree +$${reward}`, "good");
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
    const level = levelForXp(0);
    while (state.orders.length < ORDER_COUNT) state.orders.push(genOrder(level));
    jobSeq = 1;
    save();
    setMessage("Farm reset", "info");
    changed();
  },
};
