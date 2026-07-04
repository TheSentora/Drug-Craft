"use client";

import { levelForXp } from "./levels";
import { gameStore } from "./store";
import { cloudEnabled, supabase } from "./supabase";
import { SaveData } from "./types";

export interface CloudUser {
  id: string;
  email: string;
}

type Status = "idle" | "syncing" | "synced" | "error";

let user: CloudUser | null = null;
let status: Status = "idle";
let initialized = false;
let authChecked = false;
/** True once the first local↔cloud reconcile has settled (or there's nothing to load). */
let reconciled = false;
/** Player chose "play as guest" — skip the login gate, localStorage only. */
let guest = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

const GUEST_KEY = "drugcraft:guest";

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function setUser(u: CloudUser | null) {
  user = u;
  notify();
}
function setStatus(s: Status) {
  status = s;
  notify();
}

/** Upsert the current save + denormalized stats for this user. */
async function push() {
  if (!supabase || !user) return;
  const snap = gameStore.snapshot();
  setStatus("syncing");
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      username: user.email.split("@")[0] || "player",
      cash: Math.round(snap.cash),
      xp: Math.round(snap.xp),
      level: levelForXp(snap.xp),
      lab2_unlocked: !!snap.lab2Unlocked,
      trees_chopped: snap.choppedTrees?.length ?? 0,
      save: snap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  setStatus(error ? "error" : "synced");
}

function schedulePush() {
  if (!user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

/** On login, reconcile local vs cloud (newest lastSeen wins). */
async function pullAndReconcile() {
  if (!supabase || !user) return;
  setStatus("syncing");
  const { data, error } = await supabase
    .from("profiles")
    .select("save")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    setStatus("error");
    return;
  }
  const remote = (data?.save as SaveData | undefined) ?? null;
  const localSeen = gameStore.lastSeen();
  if (remote && (remote.lastSeen ?? 0) > localSeen) {
    // Cloud is newer → load it into the game.
    gameStore.loadRemote(remote);
    setStatus("synced");
  } else {
    // Local is newer (or no cloud save yet) → push local up.
    await push();
  }
}

export const cloud = {
  enabled: cloudEnabled,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getUser(): CloudUser | null {
    return user;
  },
  getStatus(): Status {
    return status;
  },
  /** True once the initial session lookup has completed (avoids a login flash). */
  ready(): boolean {
    return authChecked;
  },
  /** True once the cloud save has been reconciled — safe to trust local state. */
  hydrated(): boolean {
    return reconciled;
  },
  /** Playing without an account (localStorage only, no sync). */
  isGuest(): boolean {
    return guest;
  },
  /** Skip login and play as a guest. */
  playAsGuest() {
    guest = true;
    try {
      window.localStorage.setItem(GUEST_KEY, "1");
    } catch {}
    notify();
  },
  /** Leave guest mode (e.g. to log in / sign up). */
  exitGuest() {
    guest = false;
    try {
      window.localStorage.removeItem(GUEST_KEY);
    } catch {}
    notify();
  },

  async init() {
    if (initialized || !supabase) return;
    initialized = true;

    try {
      guest = window.localStorage.getItem(GUEST_KEY) === "1";
    } catch {}

    // Push to cloud whenever the game saves locally.
    gameStore.onSaved(() => schedulePush());

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const u = data.session.user;
      setUser({ id: u.id, email: u.email ?? "" });
    }
    // Strip the confirmation/login token out of the address bar once it's used.
    if (
      typeof window !== "undefined" &&
      /access_token|refresh_token|[?#&]type=/.test(location.hash + location.search)
    ) {
      history.replaceState(null, "", location.pathname);
    }
    authChecked = true;
    notify();
    if (data.session?.user) await pullAndReconcile();
    reconciled = true;
    notify();

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const wasLoggedOut = !user;
        // A real login supersedes guest mode.
        guest = false;
        try {
          window.localStorage.removeItem(GUEST_KEY);
        } catch {}
        setUser({ id: u.id, email: u.email ?? "" });
        if (wasLoggedOut) {
          // Hold off trusting local state until this login's save is reconciled.
          reconciled = false;
          notify();
          pullAndReconcile().finally(() => {
            reconciled = true;
            notify();
          });
        }
      } else {
        setUser(null);
        setStatus("idle");
      }
    });
  },

  async signUp(email: string, password: string): Promise<string | null> {
    if (!supabase) return "Cloud not configured";
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  },

  async signIn(email: string, password: string): Promise<string | null> {
    if (!supabase) return "Cloud not configured";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  async signOut() {
    if (!supabase) return;
    await push();
    await supabase.auth.signOut();
  },

  /** Access token for authenticated API calls (e.g. the admin route). */
  async token(): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
};
