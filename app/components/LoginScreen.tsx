"use client";

import AuthForm from "./AuthForm";

export default function LoginScreen() {
  return (
    <main className="relative h-full w-full overflow-hidden">
      {/* The art fills the whole screen. */}
      <img
        src="/sprites/login.png"
        alt="DrugCraft"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Scrim so the form stays readable over the art. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/70" />

      {/* Login UI on top. */}
      <div className="relative z-10 flex h-full items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl bg-black/55 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/15 backdrop-blur-md">
          <h1 className="text-center text-xl font-extrabold text-white drop-shadow">
            Hey there, Dealer 🌿
          </h1>
          <p className="mb-5 mt-1 text-center text-sm text-white/70">
            We need you to supply drugs! 
          </p>
          <AuthForm />
        </div>
      </div>
    </main>
  );
}
