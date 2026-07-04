"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Uses the env vars when present (local dev), and
 * otherwise falls back to the project's PUBLIC values so a plain deploy still
 * has login/cloud saves. These two are public-safe by design — the anon key is
 * shipped in the client bundle and every table is guarded by RLS. The secret
 * service_role key is NEVER here; it lives only in the server env.
 */
const PUBLIC_URL = "https://sycionreyjtkokyummlq.supabase.co";
const PUBLIC_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y2lvbnJleWp0a29reXVtbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNDE2NDgsImV4cCI6MjA5ODcxNzY0OH0.WYH2dJSkjy60X5HQYEUuiWOQDF3x8kbYyhzerD6YvbA";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PUBLIC_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_ANON;

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
