import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_EMAILS = (Deno.env.get("ALLOWED_EMAILS") ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getRequestIp = (req) => {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Serverkonfiguration fehlt." }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    return jsonResponse({ error: "Ungültige Anfrage." }, 400);
  }

  const emailRaw = String(payload?.email || "").trim();
  const password = String(payload?.password || "");
  if (!emailRaw || !password) {
    return jsonResponse({ error: "E-Mail und Passwort erforderlich." }, 400);
  }

  const email = emailRaw.toLowerCase();
  const ip = getRequestIp(req);
  const now = Date.now();

  const { data: record } = await db
    .from("login_rate_limits")
    .select("ip, attempts, window_start, lock_until")
    .eq("ip", ip)
    .maybeSingle();

  const lockUntilMs = record?.lock_until
    ? new Date(record.lock_until).getTime()
    : 0;

  if (lockUntilMs && lockUntilMs > now) {
    const retryAfter = Math.ceil((lockUntilMs - now) / 1000);
    return jsonResponse(
      {
        error: "Zu viele Versuche. Bitte später erneut versuchen.",
        retry_after: retryAfter,
      },
      429
    );
  }

  let attempts = record?.attempts ?? 0;
  let windowStartMs = record?.window_start
    ? new Date(record.window_start).getTime()
    : 0;

  if (!windowStartMs || now - windowStartMs > WINDOW_MS) {
    attempts = 0;
    windowStartMs = now;
  }

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  const isAllowed = ALLOWED_EMAILS.length
    ? ALLOWED_EMAILS.includes(email)
    : true;

  if (error || !data?.session || !isAllowed) {
    attempts += 1;
    let lockUntil = null;

    if (attempts >= MAX_ATTEMPTS) {
      lockUntil = new Date(now + LOCK_MS).toISOString();
    }

    await db.from("login_rate_limits").upsert({
      ip,
      attempts,
      window_start: new Date(windowStartMs).toISOString(),
      lock_until: lockUntil,
      updated_at: new Date().toISOString(),
      last_email: email,
    });

    if (lockUntil) {
      const retryAfter = Math.ceil(LOCK_MS / 1000);
      return jsonResponse(
        {
          error: "Zu viele Versuche. Bitte später erneut versuchen.",
          retry_after: retryAfter,
        },
        429
      );
    }

    return jsonResponse(
      {
        error: isAllowed
          ? "Login fehlgeschlagen. Bitte prüfen Sie Ihre Eingaben."
          : "Kein Zugriff: Dieses Konto ist nicht freigeschaltet.",
      },
      isAllowed ? 401 : 403
    );
  }

  await db.from("login_rate_limits").upsert({
    ip,
    attempts: 0,
    window_start: new Date(now).toISOString(),
    lock_until: null,
    updated_at: new Date().toISOString(),
    last_email: email,
  });

  return jsonResponse({ session: data.session, user: data.user });
});
