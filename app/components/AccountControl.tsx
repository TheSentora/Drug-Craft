"use client";

import { useState, useSyncExternalStore } from "react";
import { cloud } from "../game/cloud";
import { gameStore } from "../game/store";

const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "electroolite@gmail.com"
).toLowerCase();

/** Signed-in account chip + menu (login itself is handled by LoginScreen). */
export default function AccountControl() {
  useSyncExternalStore(
    cloud.subscribe,
    () => `${cloud.getUser()?.id ?? ""}:${cloud.getStatus()}:${cloud.isGuest()}`,
    () => "",
  );
  const [menu, setMenu] = useState(false);

  const user = cloud.getUser();
  if (!cloud.enabled) return null;

  // Guest: offer a way to log in / create an account.
  if (!user) {
    if (!cloud.isGuest()) return null;
    return (
      <button
        onClick={() => cloud.exitGuest()}
        className="rounded-lg border border-[#2a4133] bg-[#0e2a19] px-2.5 py-1.5 text-xs font-bold text-[#5fe08a] transition active:scale-95 hover:bg-[#123a22]"
        title="Create an account to save your progress"
      >
        Log in
      </button>
    );
  }

  const status = cloud.getStatus();
  const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
  const dot =
    status === "synced"
      ? "bg-[#2fbf52]"
      : status === "syncing"
        ? "bg-[#f0b23a]"
        : status === "error"
          ? "bg-[#ff6b5e]"
          : "bg-[#5c7566]";

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[#2a4133] bg-[#0e2a19] px-2.5 py-1.5 text-xs font-bold text-white transition active:scale-95 hover:bg-[#123a22]"
        title={`Signed in as ${user.email} (${status})`}
      >
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="max-w-[90px] truncate">{user.email.split("@")[0]}</span>
      </button>
      {menu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[#2a4133] bg-[#101a13] py-1 shadow-2xl">
          <div className="truncate px-3 py-1.5 text-[10px] text-[#7f9c88]">{user.email}</div>
          {isAdmin && (
            <a
              href="/admin"
              className="block px-3 py-2 text-xs font-semibold text-[#5fe08a] hover:bg-[#1a2c20]"
            >
              📊 Admin dashboard
            </a>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                gameStore.replayWelcome();
                setMenu(false);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#5fe08a] hover:bg-[#1a2c20]"
            >
              🐔 Replay intro
            </button>
          )}
          <button
            onClick={() => {
              cloud.signOut();
              setMenu(false);
            }}
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#ff8a80] hover:bg-[#3a2020]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
