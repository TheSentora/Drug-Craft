"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CROP_LIST, CROPS } from "../game/crops";
import { levelForXp, levelProgress } from "../game/levels";
import { FarmRenderer } from "../game/renderer";
import { sfx } from "../game/sfx";
import { gameStore, isReady } from "../game/store";
import { CropId } from "../game/types";
import LabScreen from "./LabScreen";
import SyntheticLab from "./SyntheticLab";

function fmtGrow(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Crop icon: the hand-made SVG, falling back to the emoji if it fails to load. */
function CropIcon({
  id,
  emoji,
  className,
}: {
  id: CropId;
  emoji: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={className}>{emoji}</span>;
  return (
    <img
      src={`/sprites/${id}.svg`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function FarmCanvas({
  onLabClick,
  onLab2Click,
}: {
  onLabClick: () => void;
  onLab2Click: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FarmRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new FarmRenderer(canvas, (i) =>
      gameStore.handlePlotClick(i),
    );
    renderer.onLabClick = onLabClick;
    renderer.onLab2Click = onLab2Click;
    rendererRef.current = renderer;
    renderer.start();
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [onLabClick, onLab2Click]);

  const btn =
    "flex h-10 w-10 items-center justify-center rounded-xl bg-black/50 text-xl font-bold text-white ring-1 ring-white/15 backdrop-blur transition active:scale-95 hover:bg-black/70";

  return (
    <div className="no-select absolute inset-0 touch-none overflow-hidden bg-[#0c241a]">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {/* Camera controls (sit above the bottom dock) */}
      <div className="absolute bottom-20 right-2 z-20 flex flex-col gap-2">
        <button className={btn} title="Zoom in" onClick={() => rendererRef.current?.zoomBy(1.25)}>
          +
        </button>
        <button className={btn} title="Zoom out" onClick={() => rendererRef.current?.zoomBy(1 / 1.25)}>
          −
        </button>
        <button
          className={`${btn} text-base`}
          title="Recenter on farm"
          onClick={() => rendererRef.current?.recenter()}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

type PanelId = "seeds" | "market" | "orders";

function DockButton({
  icon,
  label,
  active,
  badge,
  onClick,
  accent,
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[58px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
        active
          ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50"
          : accent
            ? "bg-emerald-600 text-white"
            : "text-emerald-100/80 hover:bg-white/10"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold text-black">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [lab2Open, setLab2Open] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const openLab = useCallback(() => setLabOpen(true), []);
  const openLab2 = useCallback(() => setLab2Open(true), []);
  const togglePanel = (p: PanelId) => setPanel((cur) => (cur === p ? null : p));

  // Subscribe to the store. The version number is a stable primitive snapshot.
  useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getVersion,
    gameStore.getVersion,
  );

  useEffect(() => {
    gameStore.init();
    setMuted(sfx.isMuted());
    setMounted(true);

    const onLeave = () => {
      if (document.visibilityState === "hidden") gameStore.flush();
    };
    document.addEventListener("visibilitychange", onLeave);
    return () => document.removeEventListener("visibilitychange", onLeave);
  }, []);

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1a12] text-emerald-100">
        <div className="text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 text-sm text-emerald-300/70">Loading farm…</p>
        </div>
      </main>
    );
  }

  const state = gameStore.getState();
  const level = levelForXp(state.xp);
  const prog = levelProgress(state.xp);
  const inventoryEntries = (Object.keys(state.inventory) as CropId[])
    .map((id) => [id, state.inventory[id] ?? 0] as const)
    .filter(([, qty]) => qty > 0);
  const stashValue = inventoryEntries.reduce(
    (sum, [id, qty]) => sum + CROPS[id].sellPrice * qty,
    0,
  );

  const msg = state.message;
  const msgColor =
    msg?.kind === "good"
      ? "bg-emerald-500/90"
      : msg?.kind === "bad"
        ? "bg-rose-500/90"
        : "bg-slate-700/90";

  const deliverableCount = state.orders.filter((o) =>
    gameStore.canDeliver(o),
  ).length;
  const now = Date.now();
  const readyToHarvest = state.plots.some((p) => isReady(p, now));

  const panelTitle =
    panel === "seeds" ? "🌱 Seeds" : panel === "market" ? "🏪 Market" : "📦 Orders";

  return (
    <main className="relative h-[100dvh] w-screen select-none overflow-hidden bg-[#0c241a] text-emerald-50">
      {/* Full-screen farm world */}
      <FarmCanvas onLabClick={openLab} onLab2Click={openLab2} />

      {/* Compact top bar */}
      <header className="safe-t pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/50 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur">
          <span className="text-xl">🌿</span>
          <h1 className="hidden text-lg font-extrabold tracking-tight sm:block">
            Drug<span className="text-emerald-400">Craft</span>
          </h1>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-emerald-200/80">
              Lv {level}
            </span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-emerald-950 sm:w-20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-[width] duration-300"
                style={{ width: `${Math.round(prog.pct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl bg-black/50 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur">
          <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            💵 ${state.cash.toLocaleString()}
          </div>
          <button
            onClick={() => setMuted(sfx.toggle())}
            className="rounded-lg px-2 py-1.5 text-base transition active:scale-95 hover:bg-white/10"
            title={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => {
              if (confirm("Reset your farm and start over?")) gameStore.reset();
            }}
            className="rounded-lg px-2 py-1.5 text-base text-emerald-300/60 transition active:scale-95 hover:bg-rose-500/10 hover:text-rose-300"
            title="Reset save"
          >
            ↺
          </button>
        </div>
      </header>

      {/* Toast message */}
      {msg && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 px-2">
          <div
            className={`dc-pop rounded-full px-4 py-1.5 text-center text-sm font-semibold text-white shadow-lg ${msgColor}`}
          >
            {msg.text}
          </div>
        </div>
      )}

      {/* Active panel drawer (bottom sheet on mobile, side card on desktop) */}
      {panel && (
        <div className="absolute inset-x-0 bottom-[4.75rem] z-30 mx-auto w-full max-w-md px-2 sm:left-3 sm:right-auto sm:mx-0 sm:w-80 sm:max-w-none sm:px-0">
          <div className="dc-pop overflow-hidden rounded-2xl bg-black/70 ring-1 ring-white/10 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <h2 className="text-sm font-bold text-emerald-100">{panelTitle}</h2>
              <button
                onClick={() => setPanel(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-3">
              {panel === "seeds" && (
                <div className="grid grid-cols-2 gap-2">
                  {CROP_LIST.map((c) => {
                    const locked = level < c.unlockLevel;
                    const selected = state.selectedCrop === c.id;
                    const affordable = state.cash >= c.seedCost;
                    return (
                      <button
                        key={c.id}
                        disabled={locked}
                        onClick={() => gameStore.setSelectedCrop(c.id)}
                        className={`relative flex flex-col items-start rounded-xl border p-2 text-left transition active:scale-95 ${
                          selected
                            ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/50"
                            : "border-emerald-900/70 bg-black/20 hover:border-emerald-700"
                        } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <CropIcon id={c.id} emoji={c.emoji} className="h-8 w-8 object-contain" />
                          {locked ? (
                            <span className="text-[10px] font-bold text-amber-400">
                              Lv {c.unlockLevel}
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold ${affordable ? "text-emerald-300" : "text-rose-400"}`}
                            >
                              ${c.seedCost}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 text-xs font-semibold">{c.name}</span>
                        <span className="text-[10px] text-emerald-300/50">
                          {fmtGrow(c.growSeconds)} · sells ${c.sellPrice}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {panel === "market" && (
                <div>
                  <button
                    onClick={() => gameStore.sellAll()}
                    disabled={stashValue <= 0}
                    className="mb-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow transition active:scale-95 enabled:hover:bg-emerald-500 disabled:opacity-40"
                  >
                    Sell all (${stashValue.toLocaleString()})
                  </button>
                  {inventoryEntries.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-emerald-300/40">
                      Your stash is empty. Harvest some crops!
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {inventoryEntries.map(([id, qty]) => {
                        const c = CROPS[id];
                        return (
                          <li
                            key={id}
                            className="flex items-center justify-between rounded-xl bg-black/25 px-2.5 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <CropIcon id={id} emoji={c.emoji} className="h-7 w-7 object-contain" />
                              <div className="leading-tight">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-emerald-300/50">
                                  ×{qty} · ${c.sellPrice} ea
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => gameStore.sell(id, qty)}
                              className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition active:scale-95 hover:bg-emerald-500/25"
                            >
                              Sell ${(c.sellPrice * qty).toLocaleString()}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {panel === "orders" && (
                <ul className="flex flex-col gap-2">
                  {state.orders.map((order) => {
                    const deliverable = gameStore.canDeliver(order);
                    return (
                      <li key={order.id} className="rounded-xl bg-black/25 p-2.5 ring-1 ring-white/5">
                        <ul className="mb-2 flex flex-col gap-1">
                          {order.items.map((it) => {
                            const c = CROPS[it.crop];
                            const have = state.inventory[it.crop] ?? 0;
                            const ok = have >= it.qty;
                            return (
                              <li key={it.crop} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5">
                                  <CropIcon id={it.crop} emoji={c.emoji} className="h-5 w-5 object-contain" />
                                  <span className="font-semibold">{c.name}</span>
                                </span>
                                <span className={`font-bold ${ok ? "text-emerald-300" : "text-rose-300"}`}>
                                  {Math.min(have, it.qty)}/{it.qty}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-300">
                            💵 ${order.cash.toLocaleString()}{" "}
                            <span className="text-emerald-300">+{order.xp} XP</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => gameStore.rerollOrder(order.id)}
                              title="Ask for a different order"
                              className="rounded-md px-2 py-1.5 text-[11px] text-emerald-300/60 transition active:scale-95 hover:bg-white/10 hover:text-emerald-200"
                            >
                              ↻
                            </button>
                            <button
                              onClick={() => gameStore.deliver(order.id)}
                              disabled={!deliverable}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black shadow transition active:scale-95 enabled:hover:bg-amber-400 disabled:opacity-35"
                            >
                              Deliver
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom dock */}
      <nav className="safe-b pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-black/55 p-1 ring-1 ring-white/10 backdrop-blur">
          <DockButton icon="🌱" label="Seeds" active={panel === "seeds"} onClick={() => togglePanel("seeds")} />
          <DockButton
            icon="🏪"
            label="Market"
            active={panel === "market"}
            badge={inventoryEntries.length}
            onClick={() => togglePanel("market")}
          />
          <DockButton
            icon="📦"
            label="Orders"
            active={panel === "orders"}
            badge={deliverableCount}
            onClick={() => togglePanel("orders")}
          />
          <button
            onClick={() => gameStore.harvestAll()}
            className={`flex min-w-[58px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white transition active:scale-95 ${
              readyToHarvest ? "bg-emerald-600 hover:bg-emerald-500" : "bg-white/10 hover:bg-white/15"
            }`}
          >
            <span className="text-xl leading-none">🧺</span>
            <span>Harvest</span>
          </button>
        </div>
      </nav>

      {labOpen && <LabScreen onClose={() => setLabOpen(false)} />}
      {lab2Open && <SyntheticLab onClose={() => setLab2Open(false)} />}
    </main>
  );
}
