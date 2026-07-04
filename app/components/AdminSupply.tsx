"use client";

import { useState } from "react";
import { CROP_LIST } from "../game/crops";
import { GRAM_PRODUCTS, PRODUCTS } from "../game/production";
import { gameStore } from "../game/store";
import { CropId } from "../game/types";
import { ProductChip } from "./labParts";

function SeedIcon({ id, emoji }: { id: CropId; emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-xl">{emoji}</span>;
  return (
    <img
      src={`/sprites/${id}.svg`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="h-6 w-6 object-contain"
    />
  );
}

const chip =
  "flex items-center gap-2 rounded-lg border border-[#243b2c] bg-[#0d1811] px-3 py-2 text-xs font-semibold text-white transition active:scale-95 hover:border-[#3a6b4a]";

/** Admin-only: give yourself anything in any quantity. */
export default function AdminSupply({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("10");
  const qty = Math.max(0, parseFloat(amount) || 0);
  const whole = Math.max(1, Math.round(qty));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#2a4133] bg-[#101a13] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white">📦 Admin Supply</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9db8a5] transition hover:bg-[#22362a] hover:text-white"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#7f9c88]">
          Quantity (grams allowed decimals)
        </label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          className="mb-4 w-40 rounded-lg border border-[#2a4133] bg-[#0d1811] px-3 py-2 text-sm text-white outline-none focus:border-[#2fbf52]"
        />

        <h3 className="mb-2 text-xs font-bold text-[#bcd6c4]">Money & XP</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <button className={chip} onClick={() => gameStore.adminSupply({ cash: whole })}>
            💵 Cash +{whole.toLocaleString()}
          </button>
          <button className={chip} onClick={() => gameStore.adminSupply({ usdc: qty })}>
            💰 USDC +{qty}
          </button>
          <button className={chip} onClick={() => gameStore.adminSupply({ xp: whole })}>
            ⭐ XP +{whole.toLocaleString()}
          </button>
          <button className={chip} onClick={() => gameStore.adminSupply({ unlockLab2: true })}>
            ⚗️ Unlock Synthetic Lab
          </button>
        </div>

        <h3 className="mb-2 text-xs font-bold text-[#bcd6c4]">Seeds</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {CROP_LIST.map((c) => (
            <button
              key={c.id}
              className={chip}
              onClick={() => gameStore.adminSupply({ seed: { crop: c.id, qty: whole } })}
            >
              <SeedIcon id={c.id} emoji={c.emoji} />
              {c.name} +{whole}
            </button>
          ))}
        </div>

        <h3 className="mb-2 text-xs font-bold text-[#bcd6c4]">Products</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(PRODUCTS).map((p) => {
            const grams = GRAM_PRODUCTS.includes(p.id);
            const n = grams ? qty : whole;
            return (
              <button
                key={p.id}
                className={chip}
                onClick={() => gameStore.adminSupply({ product: { id: p.id, qty: n } })}
              >
                <ProductChip id={p.id} className="h-6 w-6" />
                {p.name} +{n}
                {grams ? "g" : ""}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
