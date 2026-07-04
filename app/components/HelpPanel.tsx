"use client";

/** Plain how-to-play reference, opened from the ❓ button in the top bar. */
export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const h = "mb-1 mt-4 text-xs font-extrabold uppercase tracking-wide text-[#5fe08a] first:mt-0";
  const li = "text-[13px] leading-snug text-[#d6e6da]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2a4133] bg-[#101a13] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white">How to play</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9db8a5] transition hover:bg-[#22362a] hover:text-white"
          >
            ✕
          </button>
        </div>

        <h3 className={h}>Seeds</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>• Seeds can&apos;t be bought.</li>
          <li className={li}>
            • Chop trees to find them: tap a tree near the farm — costs $50, takes 2
            minutes, one tree at a time.
          </li>
          <li className={li}>
            • Felled trees drop a few seeds. Rare plants (coca, poppy) drop the least.
          </li>
        </ul>

        <h3 className={h}>Farming</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>
            • Pick a seed in the Seeds menu, then tap a dirt tile to plant. Up to 3
            plants fit in one tile.
          </li>
          <li className={li}>
            • Plants grow in real time — the tag shows the min–max wait. Tap the tile
            to harvest what&apos;s ready.
          </li>
          <li className={li}>• Locked dirt tiles cost cash to clear (🔒 price on the tile).</li>
        </ul>

        <h3 className={h}>Selling</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>• Market: sell harvested crops for cash.</li>
          <li className={li}>
            • Orders: deliver a bundle for bonus cash + XP. ↻ swaps an order you
            don&apos;t like.
          </li>
        </ul>

        <h3 className={h}>The Lab</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>• Tap the lab building east of the field.</li>
          <li className={li}>
            • Extract crops first (buds, leaves, alkaloids), then run them through the
            stations — drying, refining, synthesis. Timers run even while you&apos;re
            away.
          </li>
          <li className={li}>
            • Refined products (cocaine, heroin…) sell for far more than raw crops.
          </li>
          <li className={li}>• ⚡ pays cash to finish a batch instantly.</li>
        </ul>

        <h3 className={h}>Synthetic Lab</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>
            • The dark building up north. Unlocks at level 10 + $25,000.
          </li>
          <li className={li}>
            • Cooks meth and fentanyl in grams — 0.1g per batch, very slow, can&apos;t
            be rushed.
          </li>
          <li className={li}>
            • Cash Out converts grams to USDC ($50/g meth, $100/g fent). USDC can be
            withdrawn to your wallet.
          </li>
        </ul>

        <h3 className={h}>Levels</h3>
        <ul className="flex flex-col gap-1">
          <li className={li}>• XP comes from harvesting, orders and lab work.</li>
          <li className={li}>• Every level pays a cash bonus and unlocks more recipes.</li>
        </ul>
      </div>
    </div>
  );
}
