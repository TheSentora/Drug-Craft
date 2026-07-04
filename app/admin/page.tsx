"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cloud } from "../game/cloud";

interface Row {
  id: string;
  email: string;
  username: string;
  cash: number;
  level: number;
  xp: number;
  lab2_unlocked: boolean;
  trees_chopped: number;
  updated_at: string;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!cloud.enabled) {
        setError("Supabase isn't configured yet.");
        return;
      }
      await cloud.init();
      const token = await cloud.token();
      if (!token) {
        setError("Log in as the admin from the game first, then reload this page.");
        return;
      }
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load");
        return;
      }
      setRows(json.users as Row[]);
    })();
  }, []);

  const totalCash = rows?.reduce((s, r) => s + (r.cash || 0), 0) ?? 0;
  const activeToday =
    rows?.filter((r) => Date.now() - new Date(r.updated_at).getTime() < 86400000)
      .length ?? 0;

  return (
    <main className="min-h-screen bg-[#0a1410] p-4 text-emerald-50 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">
              📊 DrugCraft <span className="text-[#4ade80]">Admin</span>
            </h1>
            <p className="text-sm text-[#7f9c88]">Every player's stats.</p>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-[#2a4133] bg-[#1a2c20] px-4 py-2 text-sm font-bold transition hover:bg-[#22362a]"
          >
            ← Game
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-[#5a2420] bg-[#2a1210] p-6 text-center text-[#ff8a80]">
            {error}
          </div>
        )}

        {!error && !rows && (
          <div className="py-16 text-center text-[#7f9c88]">Loading…</div>
        )}

        {rows && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Players", rows.length.toLocaleString()],
                ["Active 24h", activeToday.toLocaleString()],
                ["Economy $", `$${totalCash.toLocaleString()}`],
                [
                  "Synthetic Labs",
                  rows.filter((r) => r.lab2_unlocked).length.toLocaleString(),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#2a4133] bg-[#101a13] p-4"
                >
                  <div className="text-[11px] uppercase tracking-wide text-[#7f9c88]">
                    {label}
                  </div>
                  <div className="text-xl font-extrabold text-[#5fe08a]">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#2a4133] bg-[#101a13]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#2a4133] text-[11px] uppercase tracking-wide text-[#7f9c88]">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Cash</th>
                    <th className="px-4 py-3">XP</th>
                    <th className="px-4 py-3">Lab2</th>
                    <th className="px-4 py-3">Trees</th>
                    <th className="px-4 py-3">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#7f9c88]">
                        No players yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#1c2c22] last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.username}</div>
                        <div className="text-[11px] text-[#7f9c88]">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-[#5fe08a]">{r.level}</td>
                      <td className="px-4 py-3">${(r.cash || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-[#9db8a5]">{(r.xp || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">{r.lab2_unlocked ? "✅" : "—"}</td>
                      <td className="px-4 py-3 text-[#9db8a5]">{r.trees_chopped || 0}</td>
                      <td className="px-4 py-3 text-[#7f9c88]">{timeAgo(r.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
