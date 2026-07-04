"use client";

import { useState } from "react";
import { levelForXp } from "../game/levels";
import {
  GRAM_PRODUCTS,
  PRODUCTS,
  REAGENTS,
  RECIPES_BY_STATION,
  STATIONS,
  USDC_PER_GRAM,
} from "../game/production";
import {
  MIN_WITHDRAW,
  STATION_SLOTS,
  finishNowCost,
  fmtGrams,
  gameStore,
  jobProgress,
} from "../game/store";
import { LabJob, ProductId, StationId } from "../game/types";

export function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

export function ProductChip({
  id,
  className = "h-5 w-5",
}: {
  id: ProductId;
  className?: string;
}) {
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

function JobCell({ job, now }: { job: LabJob; now: number }) {
  const r = RECIPES_BY_STATION[job.station].find((x) => x.id === job.recipeId);
  if (!r) return null;
  const p = jobProgress(job, now);
  const ready = p >= 1;
  const remaining = fmtRemaining(r.hours * 3600 * 1000 - (now - job.startedAt));
  const cost = finishNowCost(job, now);
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
        ready ? "border-[#4ade80] bg-[#123021]" : "border-[#243b2c] bg-[#0d1811]"
      }`}
    >
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="#243b2c" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={ready ? "#2fbf52" : PRODUCTS[r.output.product].color}
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
          className="rounded-lg bg-[#2fbf52] px-3 py-1 text-xs font-bold text-[#0a1f10] transition active:scale-95 hover:bg-[#3ad964]"
        >
          Collect
        </button>
      ) : (
        <>
          <span className="text-[11px] font-semibold text-[#bcd6c4]">{remaining}</span>
          {!GRAM_PRODUCTS.includes(r.output.product) && (
            <button
              onClick={() => gameStore.finishJobNow(job.id)}
              className="rounded-md border border-[#7a5a1a] bg-[#2a2008] px-2 py-0.5 text-[10px] font-bold text-[#f0b23a] transition active:scale-95 hover:bg-[#3a2c0c]"
            >
              ⚡ ${cost.toLocaleString()}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function StationPanel({
  station,
  now,
  level,
}: {
  station: StationId;
  now: number;
  level: number;
}) {
  const def = STATIONS.find((s) => s.id === station)!;
  const recipes = RECIPES_BY_STATION[station];
  const jobs = gameStore.jobsAt(station);
  const slots = STATION_SLOTS[station];
  const empties = Math.max(0, slots - jobs.length);
  const anyReady = jobs.some((j) => jobProgress(j, now) >= 1);

  return (
    <section className="rounded-2xl border border-[#2a4133] bg-[#101a13] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.emoji}</span>
          <h3 className="text-sm font-bold text-white">{def.name}</h3>
        </div>
        <span className="rounded-md border border-[#243b2c] bg-[#0d1811] px-2 py-1 text-[10px] font-bold text-[#7f9c88]">
          {jobs.length}/{slots}
        </span>
      </div>

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
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                can
                  ? "border-[#245e39] bg-[#0e2a19] text-[#5fe08a] hover:bg-[#123a22]"
                  : "cursor-not-allowed border-[#243b2c] bg-[#0d1811] text-[#5c7566]"
              }`}
            >
              <ProductChip id={r.output.product} className="h-5 w-5" />
              <span>{r.name}</span>
              {locked ? (
                <span className="text-[#f0b23a]">Lv {r.unlockLevel}</span>
              ) : (
                <span className="flex items-center gap-1 text-[#7f9c88]">
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
            className="ml-auto rounded-lg bg-[#2fbf52] px-2.5 py-1.5 text-xs font-bold text-[#0a1f10] transition active:scale-95 hover:bg-[#3ad964]"
          >
            Collect ready
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {jobs.map((j) => (
          <JobCell key={j.id} job={j} now={now} />
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <div
            key={`e${i}`}
            className="flex h-[118px] items-center justify-center rounded-xl border border-dashed border-[#243b2c] bg-[#0b140e] text-2xl text-[#3a5244]"
          >
            +
          </div>
        ))}
      </div>
    </section>
  );
}

export function SuppliesPanel({
  only,
}: {
  /** Restrict which reagents show (e.g. the Synthetic Lab's kit). */
  only?: ProductId[];
}) {
  const state = gameStore.getState();
  const list = only ? REAGENTS.filter((r) => only.includes(r.id)) : REAGENTS;
  return (
    <section className="rounded-2xl border border-[#2a4133] bg-[#101a13] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="text-xl">🏷️</span> Supplies
      </h3>
      <div className="flex flex-col gap-2">
        {list.map((rg) => (
          <div key={rg.id} className="flex items-center justify-between rounded-xl border border-[#243b2c] bg-[#0d1811] p-2">
            <div className="flex items-center gap-2">
              <ProductChip id={rg.id} className="h-8 w-8" />
              <div className="leading-tight">
                <div className="text-xs font-semibold">{rg.name}</div>
                <div className="text-[10px] text-[#7f9c88]">own {state.products[rg.id] ?? 0}</div>
              </div>
            </div>
            <button
              onClick={() => gameStore.buyReagent(rg.id, 1)}
              className="rounded-lg bg-[#f0b23a] px-3 py-1.5 text-xs font-bold text-[#1a1204] transition active:scale-95 hover:bg-[#ffc74e]"
            >
              Buy ${rg.buyPrice}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StashPanel() {
  const state = gameStore.getState();
  const entries = (Object.keys(state.products) as ProductId[])
    .filter((id) => (state.products[id] ?? 0) > 0 && PRODUCTS[id].sellPrice > 0)
    .sort((a, b) => PRODUCTS[b].sellPrice - PRODUCTS[a].sellPrice);
  const total = entries.reduce(
    (s, id) => s + PRODUCTS[id].sellPrice * (state.products[id] ?? 0),
    0,
  );
  return (
    <section className="rounded-2xl border border-[#2a4133] bg-[#101a13] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="text-xl">📦</span> Product Stash
        </h3>
        <button
          onClick={() => entries.forEach((id) => gameStore.sellProduct(id, state.products[id] ?? 0))}
          disabled={total <= 0}
          className="rounded-lg bg-[#2fbf52] px-3 py-1 text-xs font-bold text-[#0a1f10] transition active:scale-95 enabled:hover:bg-[#3ad964] disabled:opacity-30"
        >
          Sell all (${total.toLocaleString()})
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="py-3 text-center text-xs text-[#5c7566]">Empty.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((id) => {
            const def = PRODUCTS[id];
            const qty = state.products[id] ?? 0;
            return (
              <li key={id} className="flex items-center justify-between rounded-xl border border-[#243b2c] bg-[#0d1811] px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <ProductChip id={id} className="h-7 w-7" />
                  <div className="leading-tight">
                    <div className="text-xs font-semibold">{def.name}</div>
                    <div className="text-[10px] text-[#7f9c88]">
                      ×{qty} · ${def.sellPrice.toLocaleString()} ea
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => gameStore.sellProduct(id, qty)}
                  className="rounded-lg border border-[#245e39] bg-[#0e2a19] px-3 py-1.5 text-xs font-bold text-[#5fe08a] transition active:scale-95 hover:bg-[#123a22]"
                >
                  Sell ${(def.sellPrice * qty).toLocaleString()}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function useLevel(): number {
  return levelForXp(gameStore.getState().xp);
}

/** Convert fent/meth grams → in-game USDC, then request a payout to a wallet. */
export function CashOutPanel() {
  const state = gameStore.getState();
  const [amount, setAmount] = useState("");

  const withdrawals = state.withdrawals ?? [];

  return (
    <section className="rounded-2xl border border-[#5a3f82] bg-[#1c1230] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="text-xl">💰</span> Cash Out
        </h3>
        <span className="rounded-lg border border-[#3a6b4a] bg-[#0e2a19] px-3 py-1 text-sm font-extrabold text-[#5fe08a]">
          ${(state.usdc ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
        </span>
      </div>

      {/* Convert grams → USDC */}
      <div className="mb-3 flex flex-col gap-2">
        {GRAM_PRODUCTS.map((id) => {
          const grams = state.products[id] ?? 0;
          const rate = USDC_PER_GRAM[id] ?? 0;
          return (
            <div
              key={id}
              className="flex items-center justify-between rounded-xl border border-[#3a2a54] bg-[#241634] p-2"
            >
              <div className="flex items-center gap-2">
                <ProductChip id={id} className="h-8 w-8" />
                <div className="leading-tight">
                  <div className="text-xs font-semibold">{PRODUCTS[id].name}</div>
                  <div className="text-[10px] text-[#a892c4]">
                    {fmtGrams(grams)} · ${rate}/g
                  </div>
                </div>
              </div>
              <button
                disabled={grams <= 0}
                onClick={() => gameStore.cashOut(id)}
                className="rounded-lg border border-[#3a6b4a] bg-[#0e2a19] px-3 py-2 text-xs font-bold text-[#5fe08a] transition active:scale-95 enabled:hover:bg-[#123a22] disabled:opacity-30"
              >
                +${(grams * rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </button>
            </div>
          );
        })}
      </div>

      {/* Withdrawal wallet */}
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#a892c4]">
        Withdrawal wallet
      </label>
      <input
        value={state.withdrawWallet}
        onChange={(e) => gameStore.setWithdrawWallet(e.target.value)}
        placeholder="Your USDC wallet address"
        spellCheck={false}
        className="mb-2 w-full rounded-lg border border-[#3a2a54] bg-[#120a1c] px-3 py-2 text-xs text-white outline-none focus:border-[#8b5cf6]"
      />
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder={`Min $${MIN_WITHDRAW}`}
          className="w-full rounded-lg border border-[#3a2a54] bg-[#120a1c] px-3 py-2 text-xs text-white outline-none focus:border-[#8b5cf6]"
        />
        <button
          onClick={() => {
            gameStore.requestWithdrawal(parseFloat(amount) || 0);
            setAmount("");
          }}
          className="shrink-0 rounded-lg bg-[#8b5cf6] px-4 py-2 text-xs font-extrabold text-white transition active:scale-95 hover:bg-[#9d71ff]"
        >
          Withdraw
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-[#8a7aa8]">
        Withdrawals are reviewed and paid out manually.
      </p>

      {withdrawals.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-[#3a2a54] pt-3">
          {withdrawals.slice(0, 5).map((w) => (
            <li key={w.id} className="flex items-center justify-between text-[11px]">
              <span className="truncate text-[#c4a5f0]">
                ${w.amount} → {w.wallet.slice(0, 4)}…{w.wallet.slice(-4)}
              </span>
              <span
                className={
                  w.status === "paid"
                    ? "font-bold text-[#5fe08a]"
                    : w.status === "rejected"
                      ? "font-bold text-[#ff8a80]"
                      : "font-bold text-[#f0b23a]"
                }
              >
                {w.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
