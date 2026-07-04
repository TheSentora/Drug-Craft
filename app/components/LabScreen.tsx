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
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, rgba(52,211,153,0.14), transparent), radial-gradient(1000px 700px at 100% 120%, rgba(96,165,250,0.12), transparent)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧪</span>
          <h1 className="text-lg font-extrabold tracking-tight">
            The <span className="text-emerald-400">Lab</span>
          </h1>
          <span className="ml-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            💵 ${state.cash.toLocaleString()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition active:scale-95 hover:bg-white/20"
        >
          ← Back to farm
        </button>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            {/* Extraction bench */}
            <section className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">🔬</span> Extraction Bench
              </h3>
              <div className="flex flex-col gap-2">
                {EXTRACTIONS.map((ex) => {
                  const have = state.inventory[ex.crop] ?? 0;
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between rounded-xl bg-black/25 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <CropChip id={ex.crop} />
                        <div className="leading-tight">
                          <div className="text-xs font-semibold">{CROPS[ex.crop].name}</div>
                          <div className="flex items-center gap-1 text-[10px] text-white/45">
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
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 transition active:scale-95 enabled:hover:bg-emerald-500/25 disabled:opacity-30"
                        >
                          {ex.label}
                        </button>
                        <button
                          disabled={have < 2}
                          onClick={() => gameStore.extractAll(ex.crop)}
                          title="Extract all"
                          className="rounded-lg bg-white/5 px-2 py-1.5 text-xs font-bold text-white/70 transition active:scale-95 enabled:hover:bg-white/10 disabled:opacity-30"
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
