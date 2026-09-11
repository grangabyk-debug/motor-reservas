import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHANNEX_API_KEY = Deno.env.get("CHANNEX_INBOUND_STAGING_KEY") || "";

const CHANNEX_BASE = "https://staging.channex.io/api/v1";
const EXPECTED_CHANNEX_PROPERTY = "3e4a91b6-7d40-4230-afa7-0d6758be02ca";
const LOCAL_PROPERTY_ID = "46843e01-b551-41ed-84b6-c8805c0beaa4";
const CONNECTION_ID = "5fe514d4-e0b3-4b6d-9d69-d14ec6dfd5c4";

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

function channexHeaders() {
  return { "user-api-key": CHANNEX_API_KEY, "Content-Type": "application/json" };
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

async function validateDispatchToken(token: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hl_validate_channex_staging_dispatch_token`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return false;
  return (await res.json().catch(() => false)) === true;
}

async function fetchInbox(inboxId: string) {
  const fields = "id,property_id,connection_id,provider_event_id,event_type,status,reservation_id";
  const url = `${SUPABASE_URL}/rest/v1/hotel_channel_inbox?id=eq.${encodeURIComponent(inboxId)}&select=${fields}&limit=1`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) throw new Error(`Inbox lookup failed (${res.status})`);
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] || null : null;
  if (!row) throw new Error("Inbox event not found");
  if (String(row.property_id) !== LOCAL_PROPERTY_ID || String(row.connection_id) !== CONNECTION_ID) {
    throw new Error("Inbox event outside authorized STAGING connection");
  }
  return row;
}

async function fetchRevision(revisionId: string) {
  const res = await fetch(`${CHANNEX_BASE}/booking_revisions/${encodeURIComponent(revisionId)}`, {
    headers: channexHeaders(),
  });
  if (!res.ok) throw new Error(`Channex revision fetch failed (${res.status})`);
  const safe = sanitize(await res.json()) as any;
  if (String(attributes(safe)?.property_id || "") !== EXPECTED_CHANNEX_PROPERTY) {
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

async function markError(inboxId: string, error: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/hotel_channel_inbox?id=eq.${encodeURIComponent(inboxId)}`, {
    method: "PATCH",
    headers: dbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      status: "error",
      error: String(error instanceof Error ? error.message : error).slice(0, 500),
      processed_at: null,
    }),
  });
  if (!res.ok) throw new Error(`Inbox error update failed (${res.status})`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (!CHANNEX_API_KEY) return reply({ ok: false, staging: true, error: "STAGING inbound key not configured" }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "Invalid JSON" }, 400);
  }

  const inboxId = String(body?.inbox_id || "");
  const dispatchToken = String(body?.dispatch_token || "");
  if (!inboxId || !dispatchToken || !(await validateDispatchToken(dispatchToken))) {
    return reply({ ok: false, error: "Unauthorized" }, 401);
  }

  let inbox: any = null;
  try {
    inbox = await fetchInbox(inboxId);
    const revisionId = String(inbox.provider_event_id || "");
    if (!revisionId) throw new Error("Inbox event without revision id");

    if (inbox.status === "processed") {
      await acknowledge(revisionId);
      return reply({
        ok: true,
        staging: true,
        duplicate: true,
        revision_id: revisionId,
        reservation_id: inbox.reservation_id || null,
        ack: "success",
      });
    }

    if (!['pending','error'].includes(String(inbox.status || ''))) {
      return reply({ ok: true, staging: true, ignored: true, reason: "inbox_status_not_processable" });
    }

    const revision = await fetchRevision(revisionId);
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
    if (inbox?.id) await markError(inbox.id, error).catch(() => null);
    return reply({
      ok: false,
      staging: true,
      error: error instanceof Error ? error.message : "STAGING processing failed",
    }, 502);
  }
});
