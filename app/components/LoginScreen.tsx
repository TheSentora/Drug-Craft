"use client";

import { cloud } from "../game/cloud";
import AuthForm from "./AuthForm";
import ContractAddress from "./ContractAddress";

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

      {/* Contract address, top-left. */}
      <div className="safe-t absolute left-3 top-3 z-20">
        <ContractAddress />
      </div>

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

          <div className="mt-4 border-t border-[#2a4133] pt-3">
            <button
              onClick={() => cloud.playAsGuest()}
              className="w-full rounded-xl border border-[#2a4133] bg-[#1a2c20] px-4 py-2.5 text-sm font-bold text-[#bcd6c4] transition active:scale-[0.98] hover:bg-[#22362a]"
            >
              Play as guest
            </button>
            <p className="mt-1.5 text-center text-[11px] text-[#7f9c88]">
              No account — progress saved on this device only.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
