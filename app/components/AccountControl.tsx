"use client";

import { useState, useSyncExternalStore } from "react";
import { cloud } from "../game/cloud";

const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "electroolite@gmail.com"
).toLowerCase();

function useCloud() {
  return useSyncExternalStore(
    cloud.subscribe,
    () => `${cloud.getUser()?.id ?? ""}:${cloud.getStatus()}`,
    () => "",
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const err =
      mode === "login"
        ? await cloud.signIn(email.trim(), password)
        : await cloud.signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === "signup") {
      setNotice("Account created. If email confirmation is on, check your inbox, then log in.");
      setMode("login");
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-emerald-400/20 bg-[#0d1a12] p-6 shadow-2xl"
      >
        <div className="mb-4 text-center">
          <div className="text-3xl">🌿</div>
          <h2 className="mt-1 text-lg font-extrabold">
            {mode === "login" ? "Log in" : "Create account"}
          </h2>
          <p className="text-xs text-emerald-300/50">
            Save your farm to the cloud & play anywhere.
          </p>
        </div>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="mb-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="mb-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
        />

        {error && <p className="mb-2 text-xs font-semibold text-rose-400">{error}</p>}
        {notice && <p className="mb-2 text-xs font-semibold text-emerald-300">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-2.5 text-sm font-extrabold text-black transition enabled:hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <div className="mt-3 text-center text-xs text-white/50">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button type="button" onClick={() => setMode("signup")} className="font-bold text-emerald-300 hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Have one?{" "}
              <button type="button" onClick={() => setMode("login")} className="font-bold text-emerald-300 hover:underline">
                Log in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default function AccountControl() {
  useCloud();
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);

  if (!cloud.enabled) return null;

  const user = cloud.getUser();
  const status = cloud.getStatus();
  const isAdmin = !!user && user.email.toLowerCase() === ADMIN_EMAIL;

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 transition active:scale-95 hover:bg-emerald-500/30"
        >
          Log in
        </button>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </>
    );
  }

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
