import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHANNEX_API_KEY = Deno.env.get("CHANNEX_INBOUND_STAGING_KEY") || "";
const WEBHOOK_SECRET = Deno.env.get("CHANNEX_WEBHOOK_STAGING_SECRET") || "";

const CHANNEX_BASE = "https://staging.channex.io/api/v1";
const EXPECTED_CHANNEX_PROPERTY = "3e4a91b6-7d40-4230-afa7-0d6758be02ca";
const LOCAL_PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4";
const CONNECTION_ID = "5fe514d4-e0b3-4b6d-9d69-d14ec6dfd5c4";
const ALLOWED_EVENTS = new Set([
  "booking",
  "booking_new",
  "booking_modification",
  "booking_cancellation",
  "booking_unmapped_room",
  "booking_unmapped_rate",
  "non_acked_booking",
]);

function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function dbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function channexHeaders() {
  return {
    "user-api-key": CHANNEX_API_KEY,
    "Content-Type": "application/json",
  };
}

async function secureEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

const SENSITIVE_KEYS = /^(guarantee|guarantees|card|cards|card_number|cardholder_name|card_holder|cvv|cvc|security_code|expiration|expiration_date|expiry|credit_card|credit_card_data|payment_card|raw_message|raw_booking)$/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.test(key))
      .map(([key, nested]) => [key, sanitize(nested)])
  );
}

function attributes(revision: any) {
  return revision?.data?.attributes || revision?.attributes || revision || {};
}

async function getExistingInbox(revisionId: string) {
  const url = `${SUPABASE_URL}/rest/v1/hotel_channel_inbox?connection_id=eq.${CONNECTION_ID}&provider_event_id=eq.${encodeURIComponent(revisionId)}&select=status,reservation_id&limit=1`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) throw new Error(`Inbox lookup failed (${res.status})`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getRevision(revisionId: string) {
  const res = await fetch(`${CHANNEX_BASE}/booking_revisions/${encodeURIComponent(revisionId)}`, {
    headers: channexHeaders(),
  });
  if (!res.ok) throw new Error(`Channex revision fetch failed (${res.status})`);
  const raw = await res.json();
  const safe = sanitize(raw) as any;
  const attrs = attributes(safe);
  if (String(attrs?.property_id || "") !== EXPECTED_CHANNEX_PROPERTY) {
    throw new Error("Booking revision outside authorized STAGING property");
  }
  return safe;
}

async function importRevision(revision: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hl_channex_import_revision_staging`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify({ p_connection_id: CONNECTION_ID, p_revision: revision }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.ok) throw new Error(`Channex import failed (${res.status})`);
  return result;
}

async function acknowledge(revisionId: string) {
  const res = await fetch(`${CHANNEX_BASE}/booking_revisions/${encodeURIComponent(revisionId)}/ack`, {
    method: "POST",
    headers: channexHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Channex ACK failed (${res.status})`);
}

async function rememberFailure(revisionId: string, event: string, payload: unknown, error: unknown) {
  const safePayload = sanitize(payload) as any;
  const attrs = attributes(safePayload);
  const row = {
    property_id: LOCAL_PROPERTY_ID,
    connection_id: CONNECTION_ID,
    provider_event_id: revisionId,
    event_type: event || "booking",
    external_reservation_id: attrs?.ota_reservation_code || attrs?.booking_id || null,
    channel_code: "BDC",
    payload: safePayload,
    status: "error",
    reservation_id: null,
    error: String(error instanceof Error ? error.message : error).slice(0, 500),
    processed_at: null,
  };
  await fetch(`${SUPABASE_URL}/rest/v1/hotel_channel_inbox?on_conflict=connection_id,provider_event_id`, {
    method: "POST",
    headers: dbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(row),
  }).catch(() => null);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (!CHANNEX_API_KEY || !WEBHOOK_SECRET) {
    return reply({ ok: false, staging: true, error: "STAGING webhook secrets not configured" }, 503);
  }

  const providedSecret = req.headers.get("x-hl-channex-webhook-secret") || "";
  if (!providedSecret || !(await secureEqual(providedSecret, WEBHOOK_SECRET))) {
    return reply({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "Invalid JSON" }, 400);
  }

  const event = String(body?.event || "");
  if (!ALLOWED_EVENTS.has(event)) {
    return reply({ ok: true, staging: true, ignored: true, reason: "event_not_allowed" });
  }

  const propertyId = String(body?.property_id || body?.payload?.property_id || "");
  if (propertyId !== EXPECTED_CHANNEX_PROPERTY) {
    return reply({ ok: false, error: "Unauthorized Channex property" }, 403);
  }

  const payload = body?.payload || {};
  const revisionId = String(payload?.revision_id || payload?.booking_revision_id || "");
  if (!revisionId) {
    return reply({ ok: false, staging: true, error: "booking webhook without revision_id" }, 422);
  }

  try {
    const existing = await getExistingInbox(revisionId);
    if (existing?.status === "processed") {
      await acknowledge(revisionId);
      return reply({
        ok: true,
        staging: true,
        duplicate: true,
        revision_id: revisionId,
        reservation_id: existing.reservation_id || null,
        ack: "success",
      });
    }

    const revision = await getRevision(revisionId);
    const imported = await importRevision(revision);
    await acknowledge(revisionId);

    return reply({
      ok: true,
      staging: true,
      automatic: true,
      revision_id: revisionId,
      status: imported.status || null,
      reservation_id: imported.reservation_id || null,
      ack: "success",
    });
  } catch (error) {
    await rememberFailure(revisionId, event, body, error);
    return reply({
      ok: false,
      staging: true,
      revision_id: revisionId,
      error: error instanceof Error ? error.message : "STAGING reception failed",
    }, 502);
  }
});
