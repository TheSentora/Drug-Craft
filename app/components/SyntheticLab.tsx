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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#120a1c] text-white">
      <header className="relative z-10 flex items-center justify-between border-b border-[#3a2a54] bg-[#1c1230] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚗️</span>
          <h1 className="text-lg font-extrabold tracking-tight">
            Synthetic <span className="text-[#b794f6]">Lab</span>
          </h1>
          {unlocked && (
            <span className="ml-2 rounded-lg border border-[#5a3f82] bg-[#2a1840] px-3 py-1 text-sm font-bold text-[#c4a5f0]">
              💵 ${state.cash.toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-[#3a2a54] bg-[#241634] px-4 py-2 text-sm font-bold transition active:scale-95 hover:bg-[#2e1c42]"
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
              <div className="rounded-2xl border border-[#3a2a54] bg-[#1c1230] p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#5a3f82] bg-[#2a1840] text-5xl">
                  ⚗️
                </div>
                <h2 className="text-2xl font-extrabold">Synthetic Lab</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#a892c4]">
                  Make Meth and Fentanyl.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <span
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                      levelOk
                        ? "border-[#245e39] bg-[#0e2a19] text-[#5fe08a]"
                        : "border-[#3a2a54] bg-[#241634] text-[#a892c4]"
                    }`}
                  >
                    {levelOk ? "✓" : "🔒"} Level {LAB2_UNLOCK_LEVEL}
                    <span className="text-[#7a6a94]">(you: {level})</span>
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                      cashOk
                        ? "border-[#245e39] bg-[#0e2a19] text-[#5fe08a]"
                        : "border-[#3a2a54] bg-[#241634] text-[#a892c4]"
                    }`}
                  >
                    {cashOk ? "✓" : "💵"} ${LAB2_COST.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => gameStore.unlockLab2()}
                  disabled={!levelOk || !cashOk}
                  className="mt-6 w-full rounded-2xl bg-[#8b5cf6] px-6 py-3.5 text-base font-extrabold text-white transition active:scale-[0.98] enabled:hover:bg-[#9d71ff] disabled:cursor-not-allowed disabled:opacity-40"
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
