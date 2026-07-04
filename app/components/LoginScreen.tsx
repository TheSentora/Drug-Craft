"use client";

import AuthForm from "./AuthForm";

export default function LoginScreen() {
  return (
    <main className="relative flex min-h-[100dvh] w-screen items-center justify-center overflow-hidden bg-[#0c241a] p-4">
      {/* Blurred hero art fills the whole screen as an atmospheric backdrop. */}
      <img
        src="/sprites/login.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/75" />

      {/* Foreground: crisp banner + login card */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
        <img
          src="/sprites/login.png"
          alt="DrugCraft"
          draggable={false}
          className="mb-6 w-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        />

        <div className="w-full max-w-sm rounded-2xl border border-emerald-400/15 bg-black/55 p-5 shadow-2xl backdrop-blur-md">
          <h1 className="mb-1 text-center text-lg font-extrabold">
            Welcome, farmer 🌿
          </h1>
          <p className="mb-4 text-center text-xs text-white/50">
            Log in to grow your empire — your farm saves to the cloud.
          </p>
          <AuthForm />
        </div>
      </div>
    </main>
  );
}
