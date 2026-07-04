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
import { gameStore, growRange, plotReadyCount } from "../game/store";
import { CropId } from "../game/types";
import { cloud } from "../game/cloud";
import AccountControl from "./AccountControl";
import LabScreen from "./LabScreen";
import LoginScreen from "./LoginScreen";
import SyntheticLab from "./SyntheticLab";
import WelcomeIntro from "./WelcomeIntro";

function fmtGrow(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function fmtGrowRange(baseSeconds: number): string {
  const [lo, hi] = growRange(baseSeconds);
  return `${fmtGrow(lo)}–${fmtGrow(hi)}`;
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
    "flex h-10 w-10 items-center justify-center rounded-lg border border-[#2a4133] bg-[#132018] text-xl font-bold text-white transition active:scale-95 hover:bg-[#1b2c22]";

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
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex min-w-[58px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
        active
          ? "bg-[#1f5233] text-white"
          : accent
            ? "bg-[#2fbf52] text-[#0a1f10]"
            : "text-[#bcd6c4] hover:bg-[#22362a]"
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
  // Re-render on cloud auth changes (login / logout / session check / reconcile / guest).
  useSyncExternalStore(
    cloud.subscribe,
    () => `${cloud.ready()}:${cloud.hydrated()}:${cloud.isGuest()}:${cloud.getUser()?.id ?? ""}`,
    () => "server",
  );

  useEffect(() => {
    gameStore.init();
    cloud.init();
    setMuted(sfx.isMuted());
    setMounted(true);

    const onLeave = () => {
      if (document.visibilityState === "hidden") gameStore.flush();
    };
    document.addEventListener("visibilitychange", onLeave);
    return () => document.removeEventListener("visibilitychange", onLeave);
  }, []);

  if (!mounted || (cloud.enabled && !cloud.ready())) {
    return (
      <main className="flex h-full w-full items-center justify-center bg-[#0f1a12] text-emerald-100">
        <div className="text-center">
          <div className="text-4xl">🌱</div>
          <p className="mt-3 text-sm text-emerald-300/70">Loading farm…</p>
        </div>
      </main>
    );
  }

  // When cloud saves are on, require login — unless the player chose to play
  // as a guest (localStorage only, no account).
  if (cloud.enabled && !cloud.getUser() && !cloud.isGuest()) {
    return <LoginScreen />;
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
      ? "bg-[#2fbf52] text-[#0a1f10]"
      : msg?.kind === "bad"
        ? "bg-[#e0463c] text-white"
        : "bg-[#243b2c] text-white";

  const deliverableCount = state.orders.filter((o) =>
    gameStore.canDeliver(o),
  ).length;
  const now = Date.now();
  const readyToHarvest = state.plots.some((p) => plotReadyCount(p, now) > 0);

  const panelTitle =
    panel === "seeds" ? "🌱 Seeds" : panel === "market" ? "🏪 Market" : "📦 Orders";

  return (
    <main className="relative h-full w-full select-none overflow-hidden bg-[#0c241a] text-emerald-50">
      {/* Full-screen farm world */}
      <FarmCanvas onLabClick={openLab} onLab2Click={openLab2} />

      {/* Compact top bar */}
      <header className="safe-t pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-[#2a4133] bg-[#132018] px-3 py-1.5">
          <span className="text-xl">🌿</span>
          <h1 className="hidden text-lg font-extrabold tracking-tight sm:block">
            Drug<span className="text-[#4ade80]">Craft</span>
          </h1>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#bcd6c4]">Lv {level}</span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#0a1f13] sm:w-20">
              <div
                className="h-full rounded-full bg-[#2fbf52] transition-[width] duration-300"
                style={{ width: `${Math.round(prog.pct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-[#2a4133] bg-[#132018] px-2 py-1.5">
          <div className="rounded-lg border border-[#245e39] bg-[#0e2a19] px-3 py-1 text-sm font-bold text-[#5fe08a]">
            💵 ${state.cash.toLocaleString()}
          </div>
          <AccountControl />
          <button
            onClick={() => setMuted(sfx.toggle())}
            className="rounded-lg px-2 py-1.5 text-base transition active:scale-95 hover:bg-[#22362a]"
            title={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => {
              if (confirm("Reset your farm and start over?")) gameStore.reset();
            }}
            className="rounded-lg px-2 py-1.5 text-base text-[#9db8a5] transition active:scale-95 hover:bg-[#3a2020] hover:text-[#ff8a80]"
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
          <div className="dc-pop overflow-hidden rounded-2xl border border-[#2a4133] bg-[#101a13] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a4133] bg-[#152219] px-3 py-2">
              <h2 className="text-sm font-bold text-white">{panelTitle}</h2>
              <button
                onClick={() => setPanel(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9db8a5] transition hover:bg-[#22362a] hover:text-white"
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
                    const owned = state.seeds[c.id] ?? 0;
                    return (
                      <button
                        key={c.id}
                        disabled={locked}
                        onClick={() => gameStore.setSelectedCrop(c.id)}
                        className={`relative flex flex-col items-start rounded-xl border p-2 text-left transition active:scale-95 ${
                          selected
                            ? "border-[#4ade80] bg-[#123021]"
                            : "border-[#243b2c] bg-[#0d1811] hover:border-[#3a6b4a]"
                        } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <CropIcon id={c.id} emoji={c.emoji} className="h-8 w-8 object-contain" />
                          {locked ? (
                            <span className="text-[10px] font-bold text-[#f0b23a]">
                              Lv {c.unlockLevel}
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold ${owned > 0 ? "text-[#5fe08a]" : "text-[#5c7566]"}`}
                            >
                              ×{owned}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 text-xs font-semibold text-white">{c.name}</span>
                        <span className="text-[10px] text-[#7f9c88]">
                          {fmtGrowRange(c.growSeconds)} · sells ${c.sellPrice}
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
                    className="mb-2 w-full rounded-lg bg-[#2fbf52] px-3 py-2 text-sm font-bold text-[#0a1f10] transition active:scale-95 enabled:hover:bg-[#3ad964] disabled:opacity-40"
                  >
                    Sell all (${stashValue.toLocaleString()})
                  </button>
                  {inventoryEntries.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-[#7f9c88]">
                      Empty.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {inventoryEntries.map(([id, qty]) => {
                        const c = CROPS[id];
                        return (
                          <li
                            key={id}
                            className="flex items-center justify-between rounded-xl border border-[#243b2c] bg-[#0d1811] px-2.5 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <CropIcon id={id} emoji={c.emoji} className="h-7 w-7 object-contain" />
                              <div className="leading-tight">
                                <div className="text-xs font-semibold text-white">{c.name}</div>
                                <div className="text-[10px] text-[#7f9c88]">
                                  ×{qty} · ${c.sellPrice} ea
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => gameStore.sell(id, qty)}
                              className="rounded-lg border border-[#245e39] bg-[#0e2a19] px-3 py-2 text-xs font-bold text-[#5fe08a] transition active:scale-95 hover:bg-[#123a22]"
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
                      <li key={order.id} className="rounded-xl border border-[#243b2c] bg-[#0d1811] p-2.5">
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
                                <span className={`font-bold ${ok ? "text-[#5fe08a]" : "text-[#ff8a80]"}`}>
                                  {Math.min(have, it.qty)}/{it.qty}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#f0b23a]">
                            💵 ${order.cash.toLocaleString()}{" "}
                            <span className="text-[#5fe08a]">+{order.xp} XP</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => gameStore.rerollOrder(order.id)}
                              title="Ask for a different order"
                              className="rounded-md px-2 py-1.5 text-[11px] text-[#9db8a5] transition active:scale-95 hover:bg-[#22362a] hover:text-white"
                            >
                              ↻
                            </button>
                            <button
                              onClick={() => gameStore.deliver(order.id)}
                              disabled={!deliverable}
                              className="rounded-lg bg-[#f0b23a] px-3 py-1.5 text-[11px] font-bold text-[#1a1204] transition active:scale-95 enabled:hover:bg-[#ffc74e] disabled:opacity-35"
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
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-[#2a4133] bg-[#132018] p-1">
          <DockButton
            icon={
              <CropIcon
                id={state.selectedCrop}
                emoji={CROPS[state.selectedCrop].emoji}
                className="h-5 w-5 object-contain"
              />
            }
            label="Seeds"
            active={panel === "seeds"}
            onClick={() => togglePanel("seeds")}
          />
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
            className={`flex min-w-[58px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
              readyToHarvest
                ? "bg-[#2fbf52] text-[#0a1f10] hover:bg-[#3ad964]"
                : "bg-[#22362a] text-[#bcd6c4] hover:bg-[#2b4335]"
            }`}
          >
            <span className="text-xl leading-none">🧺</span>
            <span>Harvest</span>
          </button>
        </div>
      </nav>

      {labOpen && <LabScreen onClose={() => setLabOpen(false)} />}
      {lab2Open && <SyntheticLab onClose={() => setLab2Open(false)} />}

      {/* New players are greeted by Chikkie's welcome book (once cloud has settled). */}
      {!state.welcomed && (!cloud.enabled || cloud.hydrated()) && <WelcomeIntro />}
    </main>
  );
}
