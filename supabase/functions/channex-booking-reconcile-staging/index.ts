import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHANNEX_API_KEY = Deno.env.get("CHANNEX_INBOUND_STAGING_KEY") || "";

const CHANNEX_BASE = "https://staging.channex.io/api/v1";
const EXPECTED_CHANNEX_PROPERTY = "3e4a91b6-7d40-4230-afa7-0d6758be02ca";
const CONNECTION_ID = "5fe514d4-e0b3-4b6d-9d69-d14ec6dfd5c4";
const MAX_REVISIONS = 20;

function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function dbHeaders() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
}

function channexHeaders() {
  return {
    "user-api-key": CHANNEX_API_KEY,
    "Content-Type": "application/json",
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

function attributes(revision: any) {
  return revision?.data?.attributes || revision?.attributes || revision || {};
}

function revisionId(revision: any) {
  return String(revision?.id || revision?.data?.id || attributes(revision)?.id || "");
}

async function fetchFeed() {
  const url = new URL(`${CHANNEX_BASE}/booking_revisions/feed`);
  url.searchParams.set("filter[property_id]", EXPECTED_CHANNEX_PROPERTY);
  url.searchParams.set("order[inserted_at]", "asc");
  url.searchParams.set("pagination[limit]", String(MAX_REVISIONS));
  const res = await fetch(url, { headers: channexHeaders() });
  if (!res.ok) throw new Error(`Channex feed failed (${res.status})`);
  const body = await res.json();
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return rows.slice(0, MAX_REVISIONS).map((row: unknown) => sanitize(row));
}

async function importRevision(revision: unknown) {
  const attrs = attributes(revision);
  if (String(attrs?.property_id || "") !== EXPECTED_CHANNEX_PROPERTY) {
    throw new Error("Feed revision outside authorized STAGING property");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hl_channex_import_revision_staging`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify({ p_connection_id: CONNECTION_ID, p_revision: revision }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.ok) throw new Error(`Channex import failed (${res.status})`);
  return result;
}

async function acknowledge(id: string) {
  const res = await fetch(`${CHANNEX_BASE}/booking_revisions/${encodeURIComponent(id)}/ack`, {
    method: "POST",
    headers: channexHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Channex ACK failed (${res.status})`);
}

Deno.serve(async (req: Request) => {
  if (!CHANNEX_API_KEY) return reply({ ok: false, staging: true, error: "STAGING inbound key not configured" }, 503);
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);

  try {
    const feed = await fetchFeed();
    const results: Array<Record<string, unknown>> = [];

    for (const revision of feed) {
      const id = revisionId(revision);
      if (!id) {
        results.push({ ok: false, error: "revision_without_id" });
        continue;
      }
      try {
        const imported = await importRevision(revision);
        await acknowledge(id);
        results.push({
          ok: true,
          revision_id: id,
          status: imported.status || null,
          reservation_id: imported.reservation_id || null,
          ack: "success",
        });
      } catch (error) {
        results.push({
          ok: false,
          revision_id: id,
          error: error instanceof Error ? error.message : "reconciliation_failed",
        });
      }
    }

    const failed = results.filter((item) => item.ok === false).length;
    return reply({
      ok: failed === 0,
      staging: true,
      reconciliation: true,
      received: feed.length,
      processed: results.length - failed,
      failed,
      results,
    }, failed ? 207 : 200);
  } catch (error) {
    return reply({
      ok: false,
      staging: true,
      reconciliation: true,
      error: error instanceof Error ? error.message : "feed_failed",
    }, 502);
  }
});
