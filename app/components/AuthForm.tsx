"use client";

import { useState } from "react";
import { cloud } from "../game/cloud";

export default function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
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
      setNotice("Account created — if email confirmation is on, check your inbox, then log in.");
      setMode("login");
    } else {
      onDone?.();
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        autoComplete="email"
        className="mb-2 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 6 chars)"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="mb-3 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
      />

      {error && <p className="mb-2 text-xs font-semibold text-rose-400">{error}</p>}
      {notice && <p className="mb-2 text-xs font-semibold text-emerald-300">{notice}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-3 text-base font-extrabold text-black shadow-lg transition active:scale-[0.98] enabled:hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "…" : mode === "login" ? "Log in & play" : "Sign up"}
      </button>

      <div className="mt-3 text-center text-xs text-white/60">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("login")} className="font-bold text-emerald-300 hover:underline">
              Log in
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-bold text-emerald-300 hover:underline">
              Sign up
            </button>
          </>
        )}
      </div>
    </form>
  );
}
