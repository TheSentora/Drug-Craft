"use client";

import { CROPS, CROP_LIST } from "./crops";
import { levelForXp } from "./levels";
import { sfx } from "./sfx";
import { CropId, MessageKind, Order, Plot, SaveData } from "./types";
import { FIELD_H, FIELD_W } from "./world";

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
  kind: "sparkle" | "text";
  plotIndex?: number;
  text?: string;
}

export interface GameState {
  cash: number;
  xp: number;
  plots: Plot[];
  inventory: Partial<Record<CropId, number>>;
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
    selectedCrop: "tobacco",
    orders: [],
    message: null,
  };
}

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

/** Add XP, announcing level-ups. */
function addXp(n: number) {
  const before = levelForXp(state.xp);
  state.xp += n;
  const after = levelForXp(state.xp);
  if (after > before) {
    setMessage(`⭐ Level up! You reached level ${after}`, "good");
    sfx.play("levelup");
  }
}

// ---- Persistence ----------------------------------------------------------

function save() {
  if (typeof window === "undefined") return;
  const data: SaveData = {
    v: SAVE_VERSION,
    cash: state.cash,
    xp: state.xp,
    plots: state.plots,
    inventory: state.inventory,
    selectedCrop: state.selectedCrop,
    lastSeen: Date.now(),
    orders: state.orders,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / blocked — ignore */
  }
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
      const plots: Plot[] = Array.from({ length: TOTAL_PLOTS }, (_, i) => {
        const p = data.plots[i];
        return p
          ? {
              unlocked: !!p.unlocked,
              crop: p.crop ?? null,
              plantedAt: p.plantedAt ?? null,
            }
          : { unlocked: i < INITIAL_UNLOCKED, crop: null, plantedAt: null };
      });
      state = {
        cash: Number.isFinite(data.cash) ? data.cash : START_CASH,
        xp: Number.isFinite(data.xp) ? data.xp : 0,
        plots,
        inventory: data.inventory ?? {},
        selectedCrop: CROPS[data.selectedCrop] ? data.selectedCrop : "tobacco",
        orders: Array.isArray(data.orders) ? data.orders.filter(validOrder) : [],
        message: null,
      };
      orderSeq = state.orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;

      const now = Date.now();
      const readyCount = state.plots.filter((p) => isReady(p, now)).length;
      if (readyCount > 0) {
        setMessage(
          `Welcome back! ${readyCount} plot${readyCount > 1 ? "s" : ""} ready to harvest.`,
          "good",
        );
      }
    }
    // Top up the orders board.
    const level = levelForXp(state.xp);
    while (state.orders.length < ORDER_COUNT) state.orders.push(genOrder(level));
    notify();
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

  reset() {
    state = defaultState();
    const level = levelForXp(0);
    while (state.orders.length < ORDER_COUNT) state.orders.push(genOrder(level));
    save();
    setMessage("Farm reset", "info");
    changed();
  },
};
