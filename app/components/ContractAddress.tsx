"use client";

import { useState } from "react";

export const CONTRACT_ADDRESS = "2Nmgb5Su5wRGVR7aC4PmpiKUQy7P4SPfKWCamdghpump";

/** Solid, click-to-copy contract-address box. */
export default function ContractAddress({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    } catch {
      // Fallback for older/insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = CONTRACT_ADDRESS;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={copy}
      title="Copy contract address"
      className={`flex items-center gap-2 rounded-xl border border-[#2a4133] bg-[#132018] px-3 py-1.5 transition active:scale-95 hover:bg-[#1b2c22] ${className}`}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7f9c88]">
        CA
      </span>
      <span className="max-w-[52vw] truncate font-mono text-[11px] font-semibold text-white sm:max-w-none">
        {CONTRACT_ADDRESS}
      </span>
      <span
        className={`shrink-0 text-xs font-bold ${copied ? "text-[#5fe08a]" : "text-[#bcd6c4]"}`}
      >
        {copied ? "✓ Copied" : "Copy"}
      </span>
    </button>
  );
}
