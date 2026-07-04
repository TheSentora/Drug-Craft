"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { levelForXp } from "../game/levels";
import { STATIONS } from "../game/production";
import { LAB2_COST, LAB2_UNLOCK_LEVEL, gameStore } from "../game/store";
import { StashPanel, StationPanel, SuppliesPanel } from "./labParts";

export default function SyntheticLab({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useSyncExternalStore(gameStore.subscribe, gameStore.getVersion, gameStore.getVersion);

  const state = gameStore.getState();
  const level = levelForXp(state.xp);
  const unlocked = state.lab2Unlocked;
  const levelOk = level >= LAB2_UNLOCK_LEVEL;
  const cashOk = state.cash >= LAB2_COST;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#100a18] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 600px at 15% -10%, rgba(167,139,250,0.22), transparent), radial-gradient(900px 700px at 100% 120%, rgba(96,165,250,0.14), transparent)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚗️</span>
          <h1 className="text-lg font-extrabold tracking-tight">
            Synthetic <span className="text-violet-400">Lab</span>
          </h1>
          {unlocked && (
            <span className="ml-2 rounded-full bg-violet-500/15 px-3 py-1 text-sm font-bold text-violet-200 ring-1 ring-violet-400/30">
              💵 ${state.cash.toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition active:scale-95 hover:bg-white/20"
        >
          ← Back to farm
        </button>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto p-5">
        {unlocked ? (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4">
              <SuppliesPanel only={["precursor", "sulfuric_acid", "acetic_anhydride"]} />
              <StashPanel />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-2">
              {STATIONS.filter((s) => s.lab === 2).map((s) => (
                <StationPanel key={s.id} station={s.id} now={now} level={level} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-2xl">
              <div className="rounded-3xl border border-violet-400/20 bg-black/40 p-8 text-center shadow-[0_0_60px_rgba(167,139,250,0.15)] backdrop-blur">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/15 text-5xl ring-1 ring-violet-400/30">
                  ⚗️
                </div>
                <h2 className="text-2xl font-extrabold">Synthetic Lab</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
                  Make Meth and Fentanyl.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                      levelOk
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : "bg-white/5 text-white/50 ring-white/10"
                    }`}
                  >
                    {levelOk ? "✓" : "🔒"} Level {LAB2_UNLOCK_LEVEL}
                    <span className="text-white/40">(you: {level})</span>
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                      cashOk
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : "bg-white/5 text-white/50 ring-white/10"
                    }`}
                  >
                    {cashOk ? "✓" : "💵"} ${LAB2_COST.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => gameStore.unlockLab2()}
                  disabled={!levelOk || !cashOk}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-base font-extrabold text-white shadow-lg transition active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {levelOk
                    ? cashOk
                      ? `Unlock — $${LAB2_COST.toLocaleString()}`
                      : "Not enough cash"
                    : `Reach level ${LAB2_UNLOCK_LEVEL} first`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
