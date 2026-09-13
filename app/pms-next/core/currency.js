export const DEFAULT_RATE_CURRENCY="ARS"
export const DEFAULT_FX_MODE="automatic"

export function normalizeRateCurrency(value){return String(value||"").toUpperCase()==="USD"?"USD":"ARS"}
export function normalizeFxMode(value){return value==="manual"?"manual":"automatic"}
export function pricingFromSettings(settings={}){const pricing=settings?.pricing||{};return{rateCurrency:normalizeRateCurrency(pricing.rate_currency),fxMode:normalizeFxMode(pricing.fx_mode),manualUsdArs:Math.max(0,Number(pricing.manual_usd_ars)||0),lastConversionRate:Math.max(0,Number(pricing.last_conversion_rate)||0),lastConversionAt:pricing.last_conversion_at||null,lastFxSource:pricing.last_fx_source||null,lastFxAsOf:pricing.last_fx_as_of||null}}
export function convertCurrency(value,from,to,usdArs){const amount=Number(value)||0,source=normalizeRateCurrency(from),target=normalizeRateCurrency(to),rate=Number(usdArs)||0;if(source===target)return amount;if(rate<=0)return null;return source==="USD"?amount*rate:amount/rate}
export function oppositeCurrency(currency){return normalizeRateCurrency(currency)==="USD"?"ARS":"USD"}
export function formatCurrency(value,currency,{maximumFractionDigits}={}){const normalized=normalizeRateCurrency(currency),digits=maximumFractionDigits??(normalized==="USD"?2:0);return new Intl.NumberFormat("es-AR",{style:"currency",currency:normalized,minimumFractionDigits:normalized==="USD"?2:0,maximumFractionDigits:digits}).format(Number(value)||0)}
