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
import { gameStore } from "../game/store";
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
    "flex h-9 w-9 items-center justify-center rounded-lg bg-black/45 text-lg font-bold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/65";

  return (
    <div className="no-select absolute inset-0 touch-none overflow-hidden bg-[#0c241a]">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {/* Camera controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button className={btn} title="Zoom in" onClick={() => rendererRef.current?.zoomBy(1.2)}>
          +
        </button>
        <button className={btn} title="Zoom out" onClick={() => rendererRef.current?.zoomBy(1 / 1.2)}>
          −
        </button>
        <button
          className={`${btn} text-sm`}
          title="Recenter on farm"
          onClick={() => rendererRef.current?.recenter()}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [lab2Open, setLab2Open] = useState(false);
  const openLab = useCallback(() => setLabOpen(true), []);
  const openLab2 = useCallback(() => setLab2Open(true), []);

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

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0c241a] text-emerald-50">
      {/* Full-screen farm world */}
      <FarmCanvas onLabClick={openLab} onLab2Click={openLab2} />

      {/* Floating top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/45 px-4 py-2 ring-1 ring-white/10 backdrop-blur">
          <span className="text-2xl">🌿</span>
          <h1 className="text-xl font-extrabold tracking-tight">
            Drug<span className="text-emerald-400">Craft</span>
          </h1>
        </div>

        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-black/45 px-4 py-2 ring-1 ring-white/10 backdrop-blur">
          {/* Level + XP */}
          <div className="min-w-[140px]">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-emerald-200/80">
              <span>Level {level}</span>
              <span>
                {prog.into}/{prog.need} XP
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-emerald-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-[width] duration-300"
                style={{ width: `${Math.round(prog.pct * 100)}%` }}
              />
            </div>
          </div>

          {/* Cash */}
          <div className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            💵 ${state.cash.toLocaleString()}
          </div>

          <button
            onClick={() => setMuted(sfx.toggle())}
            className="rounded-full px-2 py-2 text-base transition hover:bg-white/10"
            title={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          <button
            onClick={() => {
              if (confirm("Reset your farm and start over?")) gameStore.reset();
            }}
            className="rounded-full px-3 py-2 text-xs font-medium text-emerald-300/50 transition hover:bg-rose-500/10 hover:text-rose-300"
            title="Reset save"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Toast message */}
      {msg && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2">
          <div
            className={`dc-pop rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-lg ${msgColor}`}
          >
            {msg.text}
          </div>
        </div>
      )}

      {/* Orders board */}
      <aside className="absolute left-3 top-20 z-20 flex max-h-[calc(100vh-10rem)] w-72 flex-col gap-2 overflow-y-auto">
        <div className="rounded-2xl bg-black/45 p-3 ring-1 ring-white/10 backdrop-blur">
          <h2 className="mb-2 px-1 text-sm font-bold text-emerald-200/80">
            📦 Orders
          </h2>
          <ul className="flex flex-col gap-2">
            {state.orders.map((order) => {
              const deliverable = gameStore.canDeliver(order);
              return (
                <li
                  key={order.id}
                  className="rounded-xl bg-black/25 p-2.5 ring-1 ring-white/5"
                >
                  <ul className="mb-2 flex flex-col gap-1">
                    {order.items.map((it) => {
                      const c = CROPS[it.crop];
                      const have = state.inventory[it.crop] ?? 0;
                      const ok = have >= it.qty;
                      return (
                        <li
                          key={it.crop}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="flex items-center gap-1.5">
                            <CropIcon
                              id={it.crop}
                              emoji={c.emoji}
                              className="h-5 w-5 object-contain"
                            />
                            <span className="font-semibold">{c.name}</span>
                          </span>
                          <span
                            className={`font-bold ${ok ? "text-emerald-300" : "text-rose-300"}`}
                          >
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
                        className="rounded-md px-1.5 py-1 text-[11px] text-emerald-300/50 transition hover:bg-white/10 hover:text-emerald-200"
                      >
                        ↻
                      </button>
                      <button
                        onClick={() => gameStore.deliver(order.id)}
                        disabled={!deliverable}
                        className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-black shadow transition enabled:hover:bg-amber-400 disabled:opacity-35"
                      >
                        Deliver
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Bottom-left: harvest + help */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3">
        <button
          onClick={() => gameStore.harvestAll()}
          className="pointer-events-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg ring-1 ring-emerald-300/30 transition hover:bg-emerald-500"
        >
          Harvest all
        </button>
        <span className="hidden rounded-lg bg-black/40 px-3 py-1.5 text-xs text-emerald-200/70 backdrop-blur sm:inline">
          Drag to pan · scroll to zoom · tap a plot to plant / harvest
        </span>
      </div>

      {/* Floating right panels */}
      <aside className="absolute right-3 top-20 z-20 flex max-h-[calc(100vh-6rem)] w-[19rem] flex-col gap-3 overflow-y-auto pb-3">
        {/* Seeds */}
        <div className="rounded-2xl bg-black/45 p-3 ring-1 ring-white/10 backdrop-blur">
          <h2 className="mb-2 px-1 text-sm font-bold text-emerald-200/80">
            🌱 Seeds
          </h2>
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
                    className={`relative flex flex-col items-start rounded-xl border p-2 text-left transition ${
                      selected
                        ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/50"
                        : "border-emerald-900/70 bg-black/20 hover:border-emerald-700"
                    } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <CropIcon
                        id={c.id}
                        emoji={c.emoji}
                        className="h-7 w-7 object-contain"
                      />
                      {locked ? (
                        <span className="text-[10px] font-bold text-amber-400">
                          Lv {c.unlockLevel}
                        </span>
                      ) : (
                        <span
                          className={`text-[11px] font-bold ${
                            affordable ? "text-emerald-300" : "text-rose-400"
                          }`}
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
          </div>

        {/* Market / stash */}
        <div className="rounded-2xl bg-black/45 p-3 ring-1 ring-white/10 backdrop-blur">
          <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-emerald-200/80">
                🏪 Market
              </h2>
              <button
                onClick={() => gameStore.sellAll()}
                disabled={stashValue <= 0}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow transition enabled:hover:bg-emerald-500 disabled:opacity-40"
              >
                Sell all (${stashValue.toLocaleString()})
              </button>
            </div>

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
                      className="flex items-center justify-between rounded-xl bg-black/20 px-2.5 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <CropIcon
                          id={id}
                          emoji={c.emoji}
                          className="h-6 w-6 object-contain"
                        />
                        <div className="leading-tight">
                          <div className="text-xs font-semibold">{c.name}</div>
                          <div className="text-[10px] text-emerald-300/50">
                            ×{qty} · ${c.sellPrice} ea
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => gameStore.sell(id, qty)}
                        className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
                      >
                        Sell ${(c.sellPrice * qty).toLocaleString()}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </aside>

      {labOpen && <LabScreen onClose={() => setLabOpen(false)} />}
      {lab2Open && <SyntheticLab onClose={() => setLab2Open(false)} />}
    </main>
  );
}
