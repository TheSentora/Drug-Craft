import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Returns every player's stats — for the admin dashboard only.
 * Uses the service-role key (server-side only) and verifies the caller is the
 * configured admin before returning anything.
 */
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (
    process.env.ADMIN_EMAIL || "electroolite@gmail.com"
  ).toLowerCase();

  if (!url || !service) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const token = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const admin = createClient(url, service, {
    auth: { persistSession: false },
  });

  const { data: got, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !got.user) {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }
  if ((got.user.email || "").toLowerCase() !== adminEmail) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id,email,username,cash,level,xp,lab2_unlocked,trees_chopped,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(2000);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ users: data ?? [] });
}
