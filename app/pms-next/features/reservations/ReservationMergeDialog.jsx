"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../../../lib/supabase"

const fmt = value => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)).replace(".", "") : "—"
const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 2 }).format(Number(value) || 0)
const roomIds = item => [...new Set([item?.habitacion_id, ...(item?.habitaciones_ids || [])].filter(Boolean).map(Number))]
const roomNames = (item, roomById) => roomIds(item).map(id => roomById.get(id)?.nombre || id).join(", ") || "Sin habitación"

export default function ReservationMergeDialog({ item, propertyId, rooms = [], onMerge, onClose, onMerged }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const roomById = useMemo(() => new Map(rooms.map(room => [Number(room.id), room])), [rooms])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        let request = supabase.from("reservas")
          .select("id,numero_reserva,nombre_huesped,email_huesped,habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,estado,no_show,moneda,precio_total,cantidad_huespedes,created_at,merged_into_id")
          .eq("property_id", propertyId)
          .neq("id", Number(item.id))
          .neq("estado", "cancelada")
          .neq("estado", "fusionada")
          .eq("no_show", false)
          .is("merged_into_id", null)
          .order("created_at", { ascending: false })
          .limit(30)
        const term = query.trim().replace(/[,%()]/g, "")
        if (term) request = request.or(`nombre_huesped.ilike.%${term}%,numero_reserva.ilike.%${term}%`)
        const { data, error: searchError } = await request
        if (searchError) throw searchError
        if (!cancelled) setResults((data || []).filter(row => row.estado !== "finalizada"))
      } catch (err) {
        if (!cancelled) setError(err?.message || "No se pudieron buscar reservas para fusionar.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, query ? 220 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, propertyId, item.id])

  const sameCurrency = !selected || String(selected.moneda || "ARS") === String(item.moneda || "ARS")
  const sharedRooms = selected ? roomIds(selected).filter(id => roomIds(item).includes(id)) : []
  const eligible = Boolean(selected) && sameCurrency && !sharedRooms.length

  async function merge() {
    if (!eligible || !confirmed || busy) return
    setBusy(true)
    setError("")
    try {
      const updated = await onMerge(Number(item.id), Number(selected.id))
      onMerged?.(updated, selected)
    } catch (err) {
      setError(err?.message || "No se pudieron fusionar las reservas.")
    } finally {
      setBusy(false)
    }
  }

  const overlay = { position: "fixed", inset: 0, zIndex: 280, display: "grid", placeItems: "center", padding: 16, background: "rgba(10,18,35,.38)", backdropFilter: "blur(10px)" }
  const panel = { width: "min(760px,calc(100vw - 28px))", maxHeight: "88vh", overflow: "auto", border: "1px solid color-mix(in srgb,#fff 35%,var(--line))", borderRadius: 20, padding: 18, background: "color-mix(in srgb,var(--panelSolid) 94%,transparent)", boxShadow: "0 30px 90px rgba(20,30,55,.3)" }
  const resultStyle = active => ({ width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: 10, textAlign: "left", padding: "11px 12px", border: `1px solid ${active ? "color-mix(in srgb,var(--accent) 48%,var(--line))" : "var(--line)"}`, borderRadius: 12, background: active ? "color-mix(in srgb,var(--accent) 8%,var(--panelSolid))" : "var(--panelSolid)", color: "var(--text)", cursor: "pointer", font: "inherit" })

  return <div style={overlay} onMouseDown={event => event.target === event.currentTarget && !busy && onClose?.()}>
    <section style={panel} role="dialog" aria-modal="true" aria-label="Fusionar reservas">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div><small style={{ display: "block", fontSize: 10, fontWeight: 900, letterSpacing: ".1em", color: "var(--accent)" }}>FUSIONAR RESERVAS</small><h3 style={{ margin: "4px 0 0", fontSize: 21 }}>Unir otra reserva a {item.numero_reserva || item.id}</h3><p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>La reserva actual queda como principal. La otra pasa a esta ficha, con habitaciones, huéspedes, pagos, mensajes y folio consolidados.</p></div>
        <button type="button" onClick={onClose} disabled={busy} style={{ width: 36, height: 36, border: "1px solid var(--line)", borderRadius: 10, background: "var(--panel)", color: "var(--text)", fontSize: 18 }}>×</button>
      </header>

      <div style={{ marginTop: 14, padding: "11px 12px", border: "1px solid color-mix(in srgb,var(--accent) 20%,var(--line))", borderRadius: 12, background: "color-mix(in srgb,var(--accent) 5%,var(--panelSolid))" }}><small style={{ display: "block", color: "var(--muted)", fontSize: 9.5, fontWeight: 850 }}>RESERVA PRINCIPAL</small><b style={{ display: "block", marginTop: 3, fontSize: 13 }}>{item.nombre_huesped} · {item.numero_reserva || item.id}</b><span style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "var(--muted)" }}>{roomNames(item, roomById)} · {fmt(item.fecha_entrada)} → {fmt(item.fecha_salida)} · {money(item.precio_total, item.moneda)}</span></div>

      <label style={{ display: "grid", gap: 5, marginTop: 14, fontSize: 10.5, fontWeight: 850 }}>Fusionar con<input value={query} onChange={event => { setQuery(event.target.value); setSelected(null); setConfirmed(false) }} placeholder="Buscar por pasajero o número de reserva…" autoFocus style={{ height: 42, border: "1px solid var(--line)", borderRadius: 11, background: "var(--panelSolid)", color: "var(--text)", font: "inherit", padding: "0 12px", outline: "none" }} /></label>

      <div style={{ display: "grid", gap: 7, marginTop: 9, maxHeight: 260, overflow: "auto" }}>
        {loading ? <div style={{ padding: 14, color: "var(--muted)", fontSize: 11 }}>Buscando reservas…</div> : results.length ? results.map(row => <button type="button" key={row.id} style={resultStyle(selected?.id === row.id)} onClick={() => { setSelected(row); setConfirmed(false); setError("") }}><span><b style={{ display: "block", fontSize: 12 }}>{row.nombre_huesped} · {row.numero_reserva || row.id}</b><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{roomNames(row, roomById)} · {fmt(row.fecha_entrada)} → {fmt(row.fecha_salida)} · {row.cantidad_huespedes || 1} huésped{Number(row.cantidad_huespedes || 1) === 1 ? "" : "es"}</small></span><strong style={{ fontSize: 11, whiteSpace: "nowrap" }}>{money(row.precio_total, row.moneda)}</strong></button>) : <div style={{ padding: 14, color: "var(--muted)", fontSize: 11 }}>No encontramos reservas activas con esa búsqueda.</div>}
      </div>

      {selected ? <div style={{ marginTop: 12, padding: 12, border: `1px solid ${eligible ? "color-mix(in srgb,#2f9b61 28%,var(--line))" : "color-mix(in srgb,var(--red) 30%,var(--line))"}`, borderRadius: 12, background: eligible ? "color-mix(in srgb,#37a96a 6%,var(--panelSolid))" : "color-mix(in srgb,var(--red) 6%,var(--panelSolid))" }}><b style={{ display: "block", fontSize: 12 }}>{eligible ? "Lista para fusionar" : "Hay que resolver algo antes"}</b><small style={{ display: "block", marginTop: 5, color: "var(--muted)", lineHeight: 1.5 }}>{!sameCurrency ? `La reserva elegida está en ${selected.moneda || "ARS"} y la principal en ${item.moneda || "ARS"}. Deben usar la misma moneda.` : sharedRooms.length ? `Ambas reservas incluyen la misma habitación (${sharedRooms.map(id => roomById.get(id)?.nombre || id).join(", ")}). Reasignala o separala antes de fusionar.` : "Se conservará la reserva actual como principal y se consolidará la otra dentro de ella."}</small></div> : null}

      {eligible ? <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, padding: "10px 11px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 10.5, lineHeight: 1.45, cursor: "pointer" }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} style={{ marginTop: 2, accentColor: "var(--accent)" }} /><span><b>Confirmo la fusión.</b> Esta acción no se puede deshacer automáticamente; la reserva secundaria quedará archivada como fusionada.</span></label> : null}
      {error ? <div role="alert" style={{ marginTop: 10, padding: "9px 10px", border: "1px solid color-mix(in srgb,var(--red) 30%,var(--line))", borderRadius: 10, background: "color-mix(in srgb,var(--red) 7%,var(--panelSolid))", color: "var(--red)", fontSize: 10.5, fontWeight: 800 }}>{error}</div> : null}
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}><button type="button" onClick={onClose} disabled={busy} style={{ height: 39, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--panelSolid)", color: "var(--text)", font: "inherit", fontWeight: 800 }}>Cancelar</button><button type="button" onClick={merge} disabled={!eligible || !confirmed || busy} style={{ height: 39, padding: "0 16px", border: 0, borderRadius: 10, background: "linear-gradient(145deg,var(--accent),var(--accent2))", color: "#fff", font: "inherit", fontWeight: 900, opacity: (!eligible || !confirmed || busy) ? .55 : 1 }}>{busy ? "Fusionando…" : "Fusionar reservas"}</button></footer>
    </section>
  </div>
}
