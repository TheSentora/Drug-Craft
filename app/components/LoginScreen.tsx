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
      {/* Flat scrim so the form stays readable over the art. */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Login UI on top. */}
      <div className="relative z-10 flex h-full items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#2a4133] bg-[#101a13] p-6 shadow-2xl">
          <h1 className="text-center text-xl font-extrabold text-white">
            Hey there, Dealer 🌿
          </h1>
          <p className="mb-5 mt-1 text-center text-sm text-[#bcd6c4]">
            We need you to supply drugs!
          </p>
          <AuthForm />
        </div>
      </div>
    </main>
  );
}
