import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function dbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
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

async function validWebhookToken(token: string) {
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hl_validate_channex_staging_webhook_token`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return false;
  return (await res.json().catch(() => false)) === true;
}

async function existingInbox(revisionId: string) {
  const fields = "id,status,reservation_id";
  const url = `${SUPABASE_URL}/rest/v1/hotel_channel_inbox?connection_id=eq.${CONNECTION_ID}&provider_event_id=eq.${encodeURIComponent(revisionId)}&select=${fields}&limit=1`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) throw new Error(`Inbox lookup failed (${res.status})`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertPending(revisionId: string, event: string, externalId: string | null, payload: unknown) {
  const row = {
    property_id: LOCAL_PROPERTY_ID,
    connection_id: CONNECTION_ID,
    provider_event_id: revisionId,
    event_type: event,
    external_reservation_id: externalId,
    channel_code: "BDC",
    payload: sanitize(payload),
    status: "pending",
    reservation_id: null,
    error: null,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/hotel_channel_inbox`, {
    method: "POST",
    headers: dbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Inbox insert failed (${res.status})`);
}

async function retryPending(id: string, event: string, externalId: string | null, payload: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/hotel_channel_inbox?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: dbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      event_type: event,
      external_reservation_id: externalId,
      payload: sanitize(payload),
      status: "pending",
      error: null,
      processed_at: null,
    }),
  });
  if (!res.ok) throw new Error(`Inbox retry failed (${res.status})`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);

  const token = req.headers.get("x-hl-channex-webhook-secret") || "";
  if (!(await validWebhookToken(token))) return reply({ ok: false, error: "Unauthorized" }, 401);

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
  const externalId = String(payload?.booking_id || "") || null;
  if (!revisionId) return reply({ ok: false, staging: true, error: "booking webhook without revision_id" }, 422);

  try {
    const current = await existingInbox(revisionId);
    if (current?.status === "processed" || current?.status === "rejected") {
      return reply({
        ok: true,
        staging: true,
        duplicate: true,
        revision_id: revisionId,
        reservation_id: current.reservation_id || null,
      });
    }
    if (current?.id) {
      if (current.status === "error") await retryPending(current.id, event, externalId, body);
      return reply({ ok: true, staging: true, captured: true, retry: current.status === "error", revision_id: revisionId });
    }

    await insertPending(revisionId, event, externalId, body);
    return reply({ ok: true, staging: true, captured: true, revision_id: revisionId });
  } catch (error) {
    return reply({ ok: false, staging: true, error: error instanceof Error ? error.message : "capture_failed" }, 500);
  }
});
