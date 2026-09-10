const TARGET = "https://motor-reservas-app-git-pms-rebuild-zero-gag7.vercel.app/api/integrations/channex/test-gbp-6519420-b7a42d"

function stop(message) {
  console.error(`[channex-test-gbp] ${message}`)
  process.exit(1)
}

if (process.env.VERCEL_ENV !== "preview") {
  console.log(`[channex-test-gbp] omitido: VERCEL_ENV=${process.env.VERCEL_ENV || "unset"}`)
  process.exit(0)
}

const oidcToken = String(process.env.VERCEL_OIDC_TOKEN || "").trim()
if (!oidcToken) stop("falta VERCEL_OIDC_TOKEN en Preview")

try {
  const response = await fetch(TARGET, {
    method: "GET",
    headers: {
      "x-vercel-trusted-oidc-idp-token": oidcToken,
      "Accept": "application/json",
    },
    redirect: "follow",
  })
  const text = await response.text()
  let payload = null
  try { payload = JSON.parse(text) } catch {}

  if (!response.ok || !payload?.ok || !payload?.rate_plan?.id) {
    stop(`Function Preview -> ${response.status} ${text.slice(0, 800)}`)
  }

  const plan = payload.rate_plan
  const safe = {
    id: plan.id,
    title: plan.title,
    currency: plan.currency,
    sell_mode: plan.sell_mode,
    rate_mode: plan.rate_mode,
    property_id: plan.property_id,
    room_type_id: plan.room_type_id,
    occupancy: plan.options?.find(option => option?.is_primary)?.occupancy,
  }
  console.log(`[channex-test-gbp] OK FUNCTION ${JSON.stringify(safe)}`)
} catch (error) {
  stop(error?.message || String(error))
}
