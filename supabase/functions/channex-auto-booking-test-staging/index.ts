import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHANNEX_API_KEY = Deno.env.get("CHANNEX_INBOUND_STAGING_KEY") || "";
const CHANNEX_BASE = "https://staging.channex.io/api/v1";
const PROPERTY_ID = "3e4a91b6-7d40-4230-afa7-0d6758be02ca";
const ROOM_TYPE_ID = "2f0ce963-ab90-45f7-a4a8-9a7b1bc90235";
const RATE_PLAN_ID = "30863ca0-5dd4-4351-b1f3-0d57792366d7";
const ARRIVAL = "2026-09-14";

function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function dbHeaders() {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" };
}
function channexHeaders() {
  return { "user-api-key": CHANNEX_API_KEY, "Content-Type": "application/json" };
}
async function validDispatchToken(token: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hl_validate_channex_staging_dispatch_token`, {
    method: "POST",
    headers: dbHeaders(),
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return false;
  return (await res.json().catch(() => false)) === true;
}

function fee(name: string, type: string, nights: number) {
  return {
    is_inclusive: false,
    name,
    nights,
    persons: 2,
    price_mode: "Per booking",
    price_per_unit: "150.00",
    total_price: "150.00",
    type,
    version: null,
  };
}

function bookingBody(status: "new" | "modified" | "cancelled", otaCode: string) {
  const twoNights = status !== "new";
  const departure = twoNights ? "2026-09-16" : "2026-09-15";
  const days: Record<string, string> = { "2026-09-14": "100.00" };
  if (twoNights) days["2026-09-15"] = "100.00";
  const nights = twoNights ? 2 : 1;
  const lodging = twoNights ? "200.00" : "100.00";
  const total = twoNights ? "800.00" : "700.00";
  const booking: Record<string, unknown> = {
    property_id: PROPERTY_ID,
    ota_reservation_code: otaCode,
    ota_name: "BookingCom",
    arrival_date: ARRIVAL,
    departure_date: departure,
    arrival_hour: "15:00",
    currency: "GBP",
    amount: total,
    payment_collect: "property",
    payment_type: null,
    ota_commission: "0.00",
    notes: "AUTOMATIC STAGING E2E TEST - Habitacion Llena",
    meta: { source: "habitacion-llena-staging-e2e" },
    occupancy: { adults: 2, children: 0, infants: 0 },
    customer: {
      name: "Auto",
      surname: "Staging",
      country: "GB",
      city: "London",
      mail: "auto-staging@example.invalid",
    },
    rooms: [{
      room_type_id: ROOM_TYPE_ID,
      rate_plan_id: RATE_PLAN_ID,
      amount: lodging,
      days,
      services: [],
      taxes: [
        fee("Service charge", "Service Charge", nights),
        fee("Cleaning fee", "Cleaning Fee", nights),
        fee("Electricity fee", "Electricity Fee", nights),
        fee("Bed linens fee", "Bed Linen Fee", nights),
      ],
      guests: [{ name: "Auto", surname: "Staging" }, { name: "Test", surname: "Guest" }],
      occupancy: { adults: 2, children: 0, infants: 0, ages: [] },
    }],
    services: [],
    deposits: [],
  };
  if (status !== "new") booking.status = status;
  return { booking };
}

async function channexRequest(path: string, method: string, body?: unknown) {
  const res = await fetch(`${CHANNEX_BASE}${path}`, {
    method,
    headers: channexHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }
  return { ok: true, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (!CHANNEX_API_KEY) return reply({ ok: false, staging: true, error: "STAGING inbound key not configured" }, 503);
  let body: any;
  try { body = await req.json(); } catch { return reply({ ok: false, error: "Invalid JSON" }, 400); }
  if (!(await validDispatchToken(String(body?.dispatch_token || "")))) return reply({ ok: false, error: "Unauthorized" }, 401);

  const action = String(body?.action || "");
  if (action === "availability") {
    const url = new URL(`${CHANNEX_BASE}/availability`);
    url.searchParams.set("filter[property_id]", PROPERTY_ID);
    url.searchParams.set("filter[date][gte]", "2026-09-14");
    url.searchParams.set("filter[date][lte]", "2026-09-15");
    const res = await fetch(url, { headers: channexHeaders() });
    const data = await res.json().catch(() => ({}));
    return reply({ ok: res.ok, staging: true, action, availability: data?.data?.[ROOM_TYPE_ID] || null }, res.ok ? 200 : res.status);
  }

  if (action === "create") {
    const otaCode = `98${Date.now().toString().slice(-8)}`;
    const result = await channexRequest("/bookings", "POST", bookingBody("new", otaCode));
    const attrs = result.data?.data?.attributes || {};
    return reply({ ok: result.ok, staging: true, action, ota_code: otaCode, booking_id: attrs.booking_id || result.data?.data?.id || null, revision_id: attrs.revision_id || null, status: attrs.status || null, channex_status: result.status, error: result.ok ? null : result.data?.errors || result.data }, result.ok ? 200 : result.status);
  }

  if (action === "modify" || action === "cancel") {
    const bookingId = String(body?.booking_id || "");
    const otaCode = String(body?.ota_code || "");
    if (!bookingId || !otaCode) return reply({ ok: false, staging: true, error: "booking_id and ota_code are required" }, 422);
    const status = action === "modify" ? "modified" : "cancelled";
    const result = await channexRequest(`/bookings/${encodeURIComponent(bookingId)}`, "PUT", bookingBody(status, otaCode));
    const attrs = result.data?.data?.attributes || {};
    return reply({ ok: result.ok, staging: true, action, ota_code: otaCode, booking_id: attrs.booking_id || bookingId, revision_id: attrs.revision_id || null, status: attrs.status || status, channex_status: result.status, error: result.ok ? null : result.data?.errors || result.data }, result.ok ? 200 : result.status);
  }

  return reply({ ok: false, staging: true, error: "Unsupported action" }, 422);
});
