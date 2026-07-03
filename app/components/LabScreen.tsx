"use client";

import { useEffect, useState } from "react";
import { CROPS } from "../game/crops";
import {
  EXTRACTIONS,
  PRODUCTS,
  REAGENTS,
  RECIPES_BY_STATION,
  STATIONS,
} from "../game/production";
import { levelForXp } from "../game/levels";
import { STATION_SLOTS, gameStore, jobProgress } from "../game/store";
import { CropId, LabJob, ProductId, StationId } from "../game/types";

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

function ProductChip({ id, className = "h-5 w-5" }: { id: ProductId; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        {PRODUCTS[id].emoji}
      </span>
    );
  return (
    <img
      src={`/sprites/${id}.png`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}

function CropChip({ id, className = "h-6 w-6" }: { id: CropId; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`inline-flex items-center justify-center ${className}`}>{CROPS[id].emoji}</span>;
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

function JobCell({ job, now }: { job: LabJob; now: number }) {
  const r = RECIPES_BY_STATION[job.station].find((x) => x.id === job.recipeId);
  if (!r) return null;
  const p = jobProgress(job, now);
  const ready = p >= 1;
  const remaining = fmtRemaining(r.hours * 3600 * 1000 - (now - job.startedAt));
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
        ready ? "border-emerald-400/70 bg-emerald-500/10" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={ready ? "#34d399" : PRODUCTS[r.output.product].color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - p)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <ProductChip id={r.output.product} className="h-9 w-9" />
        </span>
      </div>
      {ready ? (
        <button
          onClick={() => gameStore.collectJob(job.id)}
          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-black shadow transition hover:bg-emerald-400"
        >
          Collect
        </button>
      ) : (
        <span className="text-[11px] font-semibold text-white/70">{remaining}</span>
      )}
    </div>
  );
}

function StationPanel({ station, now, level }: { station: StationId; now: number; level: number }) {
  const def = STATIONS.find((s) => s.id === station)!;
  const recipes = RECIPES_BY_STATION[station];
  const jobs = gameStore.jobsAt(station);
  const slots = STATION_SLOTS[station];
  const empties = Math.max(0, slots - jobs.length);
  const anyReady = jobs.some((j) => jobProgress(j, now) >= 1);

  return (
    <section className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.emoji}</span>
          <div>
            <h3 className="text-sm font-bold text-white">{def.name}</h3>
            <p className="text-[11px] text-white/45">{def.blurb}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-white/50">
          {jobs.length}/{slots}
        </span>
      </div>

      {/* Recipe start buttons */}
      <div className="mb-3 flex flex-wrap gap-2">
        {recipes.map((r) => {
          const locked = level < r.unlockLevel;
          const can = gameStore.canStart(r);
          return (
            <button
              key={r.id}
              disabled={!can}
              onClick={() => gameStore.startJob(r.id)}
              title={r.inputs.map((i) => `${i.qty} ${PRODUCTS[i.product].name}`).join(" + ")}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                can
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                  : "cursor-not-allowed border-white/10 bg-black/20 text-white/35"
              }`}
            >
              <ProductChip id={r.output.product} className="h-5 w-5" />
              <span>{r.name}</span>
              {locked ? (
                <span className="text-amber-400">Lv {r.unlockLevel}</span>
              ) : (
                <span className="flex items-center gap-1 text-white/45">
                  {r.inputs.map((i) => (
                    <span key={i.product} className="inline-flex items-center gap-0.5">
                      {i.qty}
                      <ProductChip id={i.product} className="h-4 w-4" />
                    </span>
                  ))}
                  · {r.hours}h
                </span>
              )}
            </button>
          );
        })}
        {anyReady && (
          <button
            onClick={() => gameStore.collectAllJobs()}
            className="ml-auto rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-400"
          >
            Collect ready
          </button>
        )}
      </div>

      {/* Slots */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {jobs.map((j) => (
          <JobCell key={j.id} job={j} now={now} />
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <div
            key={`e${i}`}
            className="flex h-[104px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/15 text-2xl text-white/15"
          >
            +
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LabScreen({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = gameStore.getState();
  const level = levelForXp(state.xp);

  const stashEntries = (Object.keys(state.products) as ProductId[])
    .filter((id) => (state.products[id] ?? 0) > 0 && PRODUCTS[id].sellPrice > 0)
    .sort((a, b) => PRODUCTS[b].sellPrice - PRODUCTS[a].sellPrice);
  const stashValue = stashEntries.reduce(
    (s, id) => s + PRODUCTS[id].sellPrice * (state.products[id] ?? 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1410] text-white">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% -10%, rgba(52,211,153,0.14), transparent), radial-gradient(1000px 700px at 100% 120%, rgba(96,165,250,0.12), transparent)",
        }}
      />

      {/* Header */}
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
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          ← Back to farm
        </button>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left column: extraction + reagents + stash */}
          <div className="flex flex-col gap-4">
            {/* Extraction bench */}
            <section className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">🔬</span> Extraction Bench
              </h3>
              <p className="mb-3 text-[11px] text-white/45">
                Break harvested crops down into raw materials.
              </p>
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
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 transition enabled:hover:bg-emerald-500/25 disabled:opacity-30"
                        >
                          {ex.label}
                        </button>
                        <button
                          disabled={have < 2}
                          onClick={() => gameStore.extractAll(ex.crop)}
                          title="Extract all"
                          className="rounded-lg bg-white/5 px-2 py-1.5 text-xs font-bold text-white/70 transition enabled:hover:bg-white/10 disabled:opacity-30"
                        >
                          all
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Reagent shop */}
            <section className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">🏷️</span> Supplies
              </h3>
              <div className="flex flex-col gap-2">
                {REAGENTS.map((rg) => (
                  <div
                    key={rg.id}
                    className="flex items-center justify-between rounded-xl bg-black/25 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <ProductChip id={rg.id} className="h-8 w-8" />
                      <div className="leading-tight">
                        <div className="text-xs font-semibold">{rg.name}</div>
                        <div className="text-[10px] text-white/45">
                          own {state.products[rg.id] ?? 0}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => gameStore.buyReagent(rg.id, 1)}
                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
                    >
                      Buy ${rg.buyPrice}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Product stash */}
            <section className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <span className="text-xl">📦</span> Product Stash
                </h3>
                <button
                  onClick={() => stashEntries.forEach((id) => gameStore.sellProduct(id, state.products[id] ?? 0))}
                  disabled={stashValue <= 0}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition enabled:hover:bg-emerald-500 disabled:opacity-30"
                >
                  Sell all (${stashValue.toLocaleString()})
                </button>
              </div>
              {stashEntries.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/35">
                  No products yet. Process some crops!
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {stashEntries.map((id) => {
                    const def = PRODUCTS[id];
                    const qty = state.products[id] ?? 0;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between rounded-xl bg-black/25 px-2.5 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <ProductChip id={id} className="h-7 w-7" />
                          <div className="leading-tight">
                            <div className="text-xs font-semibold">{def.name}</div>
                            <div className="text-[10px] text-white/45">
                              ×{qty} · ${def.sellPrice} ea
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => gameStore.sellProduct(id, qty)}
                          className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
                        >
                          Sell ${(def.sellPrice * qty).toLocaleString()}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Right: stations */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {STATIONS.map((s) => (
              <StationPanel key={s.id} station={s.id} now={now} level={level} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
