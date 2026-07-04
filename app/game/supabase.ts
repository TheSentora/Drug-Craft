"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. If the env vars aren't set, this is `null` and the
 * whole game keeps working in offline (localStorage-only) mode — cloud saves
 * and login just stay hidden until you configure it.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const cloudEnabled = !!supabase;
