"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CROPS } from "../game/crops";
import { levelForXp } from "../game/levels";
import { EXTRACTIONS, STATIONS } from "../game/production";
import { gameStore } from "../game/store";
import { CropId } from "../game/types";
import { ProductChip, StashPanel, StationPanel, SuppliesPanel } from "./labParts";

function CropChip({ id, className = "h-6 w-6" }: { id: CropId; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        {CROPS[id].emoji}
      </span>
    );
  return (
    <img
      src={`/sprites/${id}.svg`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}

export default function LabScreen({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useSyncExternalStore(gameStore.subscribe, gameStore.getVersion, gameStore.getVersion);

  const state = gameStore.getState();
  const level = levelForXp(state.xp);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1410] text-white">
      <header className="relative z-10 flex items-center justify-between border-b border-[#2a4133] bg-[#101a13] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧪</span>
          <h1 className="text-lg font-extrabold tracking-tight">
            The <span className="text-[#4ade80]">Lab</span>
          </h1>
          <span className="ml-2 rounded-lg border border-[#245e39] bg-[#0e2a19] px-3 py-1 text-sm font-bold text-[#5fe08a]">
            💵 ${state.cash.toLocaleString()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-[#2a4133] bg-[#1a2c20] px-4 py-2 text-sm font-bold transition active:scale-95 hover:bg-[#22362a]"
        >
          ← Back to farm
        </button>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            {/* Extraction bench */}
            <section className="rounded-2xl border border-[#2a4133] bg-[#101a13] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">🔬</span> Extraction Bench
              </h3>
              <div className="flex flex-col gap-2">
                {EXTRACTIONS.map((ex) => {
                  const have = state.inventory[ex.crop] ?? 0;
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between rounded-xl border border-[#243b2c] bg-[#0d1811] p-2"
                    >
                      <div className="flex items-center gap-2">
                        <CropChip id={ex.crop} />
                        <div className="leading-tight">
                          <div className="text-xs font-semibold">{CROPS[ex.crop].name}</div>
                          <div className="flex items-center gap-1 text-[10px] text-[#7f9c88]">
                            <span>have {have}</span>
                            <span>→</span>
                            {ex.outputs.map((o) => (
                              <span key={o.product} className="inline-flex items-center gap-0.5">
                                {o.qty}
                                <ProductChip id={o.product} className="h-4 w-4" />
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          disabled={have < 1}
                          onClick={() => gameStore.extract(ex.crop)}
                          className="rounded-lg border border-[#245e39] bg-[#0e2a19] px-2.5 py-1.5 text-xs font-bold text-[#5fe08a] transition active:scale-95 enabled:hover:bg-[#123a22] disabled:opacity-30"
                        >
                          {ex.label}
                        </button>
                        <button
                          disabled={have < 2}
                          onClick={() => gameStore.extractAll(ex.crop)}
                          title="Extract all"
                          className="rounded-lg border border-[#2a4133] bg-[#1a2c20] px-2 py-1.5 text-xs font-bold text-[#bcd6c4] transition active:scale-95 enabled:hover:bg-[#22362a] disabled:opacity-30"
                        >
                          all
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <SuppliesPanel only={["sulfuric_acid", "gasoline", "acetic_anhydride"]} />
            <StashPanel />
          </div>

          <div className="flex flex-col gap-4 lg:col-span-2">
            {STATIONS.filter((s) => s.lab === 1).map((s) => (
              <StationPanel key={s.id} station={s.id} now={now} level={level} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
