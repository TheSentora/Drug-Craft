"use client";

import { CROPS } from "./crops";
import { levelForXp } from "./levels";
import { CropId, MessageKind, Plot, SaveData } from "./types";
import { FIELD_H, FIELD_W } from "./world";

// ---- Board / economy constants -------------------------------------------

export const TOTAL_PLOTS = FIELD_W * FIELD_H;
const INITIAL_UNLOCKED = 9;
const START_CASH = 200;
const SAVE_VERSION = 2;
const SAVE_KEY = "drugcraft:save:v2";

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

// ---- State ----------------------------------------------------------------

export interface GameMessage {
  text: string;
  kind: MessageKind;
  at: number;
}

export interface GameState {
  cash: number;
  xp: number;
  plots: Plot[];
  inventory: Partial<Record<CropId, number>>;
  selectedCrop: CropId;
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
    message: null,
  };
}

let state: GameState = defaultState();
let version = 0;
let initialized = false;

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
  notify();
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    state.message = null;
    notify();
  }, 2600);
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

  /** Load save once, on the client. Returns nothing; emits an update. */
  init() {
    if (initialized) return;
    initialized = true;
    const data = load();
    if (data) {
      // Re-hydrate, but keep the board shape consistent with current config.
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
        message: null,
      };

      // Offline growth is automatic (timestamp based). Welcome the player back
      // if anything finished while they were away.
      const now = Date.now();
      const readyCount = state.plots.filter((p) => isReady(p, now)).length;
      if (readyCount > 0) {
        setMessage(
          `Welcome back! ${readyCount} plot${readyCount > 1 ? "s" : ""} ready to harvest.`,
          "good",
        );
      }
    }
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
    changed();
  },

  harvest(index: number) {
    const plot = state.plots[index];
    if (!plot || plot.crop == null) return;
    if (!isReady(plot, Date.now())) return;
    const def = CROPS[plot.crop];
    state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
    state.xp += def.xp;
    plot.crop = null;
    plot.plantedAt = null;
    setMessage(`Harvested ${def.name} +${def.xp} XP`, "good");
    changed();
  },

  /** Harvest every ready plot at once. */
  harvestAll() {
    const now = Date.now();
    let count = 0;
    let xp = 0;
    for (const plot of state.plots) {
      if (plot.crop != null && isReady(plot, now)) {
        const def = CROPS[plot.crop];
        state.inventory[def.id] = (state.inventory[def.id] ?? 0) + 1;
        xp += def.xp;
        plot.crop = null;
        plot.plantedAt = null;
        count++;
      }
    }
    if (count === 0) {
      setMessage("Nothing ready to harvest yet", "info");
      return;
    }
    state.xp += xp;
    setMessage(`Harvested ${count} plot${count > 1 ? "s" : ""} +${xp} XP`, "good");
    changed();
  },

  sell(id: CropId, qty: number) {
    const have = state.inventory[id] ?? 0;
    const n = Math.min(qty, have);
    if (n <= 0) return;
    const def = CROPS[id];
    state.inventory[id] = have - n;
    state.cash += def.sellPrice * n;
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
    setMessage(`Sold everything for $${total.toLocaleString()}`, "good");
    changed();
  },

  reset() {
    state = defaultState();
    save();
    setMessage("Farm reset", "info");
    changed();
  },
};
