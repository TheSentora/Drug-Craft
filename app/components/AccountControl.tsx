"use client";

import { useState, useSyncExternalStore } from "react";
import { cloud } from "../game/cloud";

const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "electroolite@gmail.com"
).toLowerCase();

/** Signed-in account chip + menu (login itself is handled by LoginScreen). */
export default function AccountControl() {
  useSyncExternalStore(
    cloud.subscribe,
    () => `${cloud.getUser()?.id ?? ""}:${cloud.getStatus()}`,
    () => "",
  );
  const [menu, setMenu] = useState(false);

  const user = cloud.getUser();
  if (!cloud.enabled || !user) return null;

  const status = cloud.getStatus();
  const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
  const dot =
    status === "synced"
      ? "bg-emerald-400"
      : status === "syncing"
        ? "bg-amber-400"
        : status === "error"
          ? "bg-rose-400"
          : "bg-white/40";

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold transition active:scale-95 hover:bg-white/10"
        title={`Signed in as ${user.email} (${status})`}
      >
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="max-w-[90px] truncate">{user.email.split("@")[0]}</span>
      </button>
      {menu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d1a12] py-1 shadow-2xl">
          <div className="truncate px-3 py-1.5 text-[10px] text-white/40">{user.email}</div>
          {isAdmin && (
            <a
              href="/admin"
              className="block px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-white/5"
            >
              📊 Admin dashboard
            </a>
          )}
          <button
            onClick={() => {
              cloud.signOut();
              setMenu(false);
            }}
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
