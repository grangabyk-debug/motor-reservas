import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHANNEX_API_KEY = Deno.env.get("CHANNEX_INBOUND_STAGING_KEY") || "";
const CHANNEX_BASE = "https://staging.channex.io/api/v1";
const PROPERTY_ID = "3e4a91b6-7d40-4230-afa7-0d6758be02ca";
const CALLBACK_URL = "https://kklvahycvojoktacpyiu.supabase.co/functions/v1/channex-booking-webhook-staging";

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function dbHeaders() {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" };
}
function channexHeaders() {
  return { "user-api-key": CHANNEX_API_KEY, "Content-Type": "application/json" };
}

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} failed (${res.status})`);
  return res.json();
}

async function listWebhooks() {
  const url = new URL(`${CHANNEX_BASE}/webhooks`);
  url.searchParams.set("pagination[limit]", "100");
  const res = await fetch(url, { headers: channexHeaders() });
  if (!res.ok) throw new Error(`Channex webhooks list failed (${res.status})`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : [];
}

function propertyIdOf(item: any) {
  return String(item?.relationships?.property?.data?.id || "");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (!CHANNEX_API_KEY) return reply({ ok: false, staging: true, error: "STAGING inbound key not configured" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return reply({ ok: false, error: "Invalid JSON" }, 400); }
  const dispatchToken = String(body?.dispatch_token || "");
  const valid = await rpc("hl_validate_channex_staging_dispatch_token", { p_token: dispatchToken }).catch(() => false);
  if (valid !== true) return reply({ ok: false, error: "Unauthorized" }, 401);

  try {
    const webhookToken = await rpc("hl_get_channex_staging_webhook_token");
    if (!webhookToken || typeof webhookToken !== "string") throw new Error("STAGING webhook token unavailable");

    const hooks = await listWebhooks();
    const propertyHooks = hooks.filter((item: any) => propertyIdOf(item) === PROPERTY_ID);
    const exact = propertyHooks.filter((item: any) => String(item?.attributes?.callback_url || "") === CALLBACK_URL);
    const payload = {
      webhook: {
        callback_url: CALLBACK_URL,
        event_mask: "booking",
        property_id: PROPERTY_ID,
        request_params: {},
        headers: { "x-hl-channex-webhook-secret": webhookToken },
        is_active: true,
        send_data: true,
        is_global: false,
      },
    };

    let result: any;
    let action: "created" | "updated";
    if (exact[0]?.id) {
      const res = await fetch(`${CHANNEX_BASE}/webhooks/${encodeURIComponent(exact[0].id)}`, {
        method: "PUT",
        headers: channexHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Channex webhook update failed (${res.status})`);
      result = await res.json();
      action = "updated";
    } else {
      const res = await fetch(`${CHANNEX_BASE}/webhooks`, {
        method: "POST",
        headers: channexHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Channex webhook create failed (${res.status})`);
      result = await res.json();
      action = "created";
    }

    const hook = result?.data || {};
    return reply({
      ok: true,
      staging: true,
      action,
      webhook: {
        id: hook.id || exact[0]?.id || null,
        property_id: PROPERTY_ID,
        callback_url: hook?.attributes?.callback_url || CALLBACK_URL,
        event_mask: hook?.attributes?.event_mask || "booking",
        is_active: hook?.attributes?.is_active ?? true,
        send_data: hook?.attributes?.send_data ?? true,
      },
      matching_webhooks_before: exact.length,
      duplicate_matching_ids: exact.slice(1).map((item: any) => item.id),
    });
  } catch (error) {
    return reply({ ok: false, staging: true, error: error instanceof Error ? error.message : "webhook_admin_failed" }, 502);
  }
});
