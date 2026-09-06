"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../../../lib/supabase"

const TYPES = {
  flexible: "Flexible",
  prepaid_flexible: "Prepaga Flexible",
  non_refundable: "No Reembolsable / Anticipada",
  custom: "Personalizada",
}

const CHARGES = {
  none: "Sin cargo",
  fixed: "Importe fijo",
  percent: "Porcentaje del total",
  nights: "Noches",
}

const EMPTY_RULE = { min_days_before: 0, charge_type: "none", value: 0 }

const blank = currency => ({
  code: `POL-${Date.now().toString().slice(-6)}`,
  name: "Nueva política",
  description: "",
  policy_type: "custom",
  language: "es-AR",
  currency: currency || "ARS",
  cancellation_rules: [{ ...EMPTY_RULE }],
  no_show_rule: { charge_type: "none", value: 0 },
  early_checkout_rule: { charge_type: "none", value: 0 },
  prepayment_required: false,
  prepayment_percent: 0,
  active: true,
  is_default: false,
  visible_in_booking_engine: true,
})

const num = value => Math.max(0, Number(value) || 0)

function ChargeEditor({ title, value, onChange, currency, disabled }) {
  const rule = value || { charge_type: "none", value: 0 }
  return (
    <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 11, background: "color-mix(in srgb,var(--bg) 45%,var(--panelSolid))" }}>
      <b style={{ fontSize: 11.5 }}>{title}</b>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(170px,1fr) minmax(120px,.55fr)", gap: 8, marginTop: 8 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>
          Tipo
          <select disabled={disabled} value={rule.charge_type || "none"} onChange={e => onChange({ ...rule, charge_type: e.target.value, value: e.target.value === "none" ? 0 : rule.value || 0 })}>
            {Object.entries(CHARGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>
          Valor
          <input disabled={disabled || rule.charge_type === "none"} type="number" min="0" step={rule.charge_type === "fixed" ? "1" : "0.01"} value={rule.value || 0} onChange={e => onChange({ ...rule, value: num(e.target.value) })} />
        </label>
      </div>
      <small style={{ display: "block", marginTop: 6, color: "var(--muted)", fontSize: 9.5 }}>
        {rule.charge_type === "fixed"
          ? `Importe expresado en ${currency}.`
          : rule.charge_type === "percent"
            ? "Porcentaje sobre el total de la reserva."
            : rule.charge_type === "nights"
              ? "Cantidad de noches a tarifa de la reserva."
              : "No se cobra penalidad."}
      </small>
    </div>
  )
}

export default function CancellationPoliciesSettings({ propertyId, currency = "ARS", canEdit = false }) {
  const [policies, setPolicies] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    setError("")
    try {
      const { data, error: readError } = await supabase
        .from("hotel_cancellation_policies")
        .select("*")
        .eq("property_id", propertyId)
        .order("is_default", { ascending: false })
        .order("name")
      if (readError) throw readError
      const rows = data || []
      setPolicies(rows)
      const chosen = rows.find(row => String(row.id) === String(selectedId)) || rows[0] || null
      setSelectedId(chosen?.id || "")
      setForm(chosen ? structuredClone(chosen) : null)
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las políticas.")
    } finally {
      setLoading(false)
    }
  }, [propertyId, selectedId])

  useEffect(() => { load() }, [propertyId])

  function choose(row) {
    setSelectedId(row.id)
    setForm(structuredClone(row))
    setError("")
    setNotice("")
  }

  function newPolicy() {
    const next = blank(currency)
    setSelectedId("")
    setForm(next)
    setError("")
    setNotice("")
  }

  function updateRule(index, patch) {
    setForm(current => ({
      ...current,
      cancellation_rules: (current.cancellation_rules || []).map((rule, i) => i === index ? { ...rule, ...patch } : rule),
    }))
  }

  async function save() {
    if (!canEdit || !form) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      if (!String(form.name || "").trim()) throw new Error("Ingresá un nombre para la política.")
      if (!String(form.code || "").trim()) throw new Error("Ingresá un código identificador.")

      const visibleInBookingEngine = form.visible_in_booking_engine !== false
      const cleanRules = (form.cancellation_rules || [])
        .map(rule => ({
          min_days_before: Math.max(0, Number(rule.min_days_before) || 0),
          charge_type: rule.charge_type || "none",
          value: rule.charge_type === "none" ? 0 : num(rule.value),
        }))
        .sort((a, b) => b.min_days_before - a.min_days_before)

      const payload = {
        property_id: propertyId,
        code: String(form.code).trim().toUpperCase(),
        name: String(form.name).trim(),
        description: String(form.description || "").trim() || null,
        policy_type: form.policy_type || "custom",
        language: form.language || "es-AR",
        currency: form.currency || currency || "ARS",
        cancellation_rules: cleanRules,
        no_show_rule: {
          charge_type: form.no_show_rule?.charge_type || "none",
          value: form.no_show_rule?.charge_type === "none" ? 0 : num(form.no_show_rule?.value),
        },
        early_checkout_rule: {
          charge_type: form.early_checkout_rule?.charge_type || "none",
          value: form.early_checkout_rule?.charge_type === "none" ? 0 : num(form.early_checkout_rule?.value),
        },
        prepayment_required: Boolean(form.prepayment_required),
        prepayment_percent: form.prepayment_required ? Math.min(100, num(form.prepayment_percent)) : 0,
        active: form.active !== false,
        visible_in_booking_engine: visibleInBookingEngine,
        is_default: visibleInBookingEngine && Boolean(form.is_default),
        updated_by: (await supabase.auth.getUser()).data.user?.id || null,
        updated_at: new Date().toISOString(),
      }

      if (payload.is_default) {
        const { error: clearError } = await supabase
          .from("hotel_cancellation_policies")
          .update({ is_default: false })
          .eq("property_id", propertyId)
          .neq("id", form.id || "00000000-0000-0000-0000-000000000000")
        if (clearError) throw clearError
      }

      let result
      if (form.id) {
        result = await supabase
          .from("hotel_cancellation_policies")
          .update(payload)
          .eq("id", form.id)
          .eq("property_id", propertyId)
          .select()
          .single()
      } else {
        result = await supabase
          .from("hotel_cancellation_policies")
          .insert({ ...payload, created_by: payload.updated_by })
          .select()
          .single()
      }
      if (result.error) throw result.error
      setSelectedId(result.data.id)
      setNotice("Política guardada. Las reservas existentes conservan su copia histórica.")
      await load()
    } catch (err) {
      setError(err?.message || "No se pudo guardar la política.")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!canEdit || !form?.id || form.is_default) return
    if (!window.confirm(`¿Eliminar la política ${form.name}? Las reservas históricas conservarán la copia de sus condiciones.`)) return
    setSaving(true)
    setError("")
    try {
      const { error: deleteError } = await supabase
        .from("hotel_cancellation_policies")
        .delete()
        .eq("id", form.id)
        .eq("property_id", propertyId)
      if (deleteError) throw deleteError
      setSelectedId("")
      setForm(null)
      await load()
    } catch (err) {
      setError(err?.message || "No se pudo eliminar la política.")
    } finally {
      setSaving(false)
    }
  }

  const box = { padding: 14, border: "1px solid var(--line)", borderRadius: 14, background: "var(--panelSolid)" }
  const inputStyle = { width: "100%", boxSizing: "border-box" }

  if (loading) return <div style={box}>Cargando políticas de cancelación…</div>

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,.7fr) minmax(420px,1.5fr)", gap: 12, alignItems: "start" }}>
      <aside style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <small style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".1em", color: "var(--accent)" }}>POLÍTICAS</small>
            <h2 style={{ margin: "3px 0 0", fontSize: 17 }}>Cancelación</h2>
          </div>
          {canEdit ? <button type="button" onClick={newPolicy}>+ Nueva</button> : null}
        </div>
        <p style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--muted)" }}>
          Flexible queda predeterminada. Podés definir políticas públicas para el motor o sólo internas para el PMS.
        </p>
        <div style={{ display: "grid", gap: 7 }}>
          {policies.map(row => (
            <button
              type="button"
              key={row.id}
              onClick={() => choose(row)}
              style={{
                textAlign: "left",
                padding: "10px 11px",
                border: `1px solid ${String(row.id) === String(selectedId) ? "color-mix(in srgb,var(--accent) 48%,var(--line))" : "var(--line)"}`,
                borderRadius: 10,
                background: String(row.id) === String(selectedId) ? "color-mix(in srgb,var(--accent) 7%,var(--panelSolid))" : "var(--panelSolid)",
                color: "var(--text)",
              }}
            >
              <b style={{ display: "block", fontSize: 11.5 }}>{row.name}{row.is_default ? " · Predeterminada" : ""}</b>
              <small style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>
                {TYPES[row.policy_type] || "Personalizada"} · {row.active ? "Activa" : "Inactiva"} · {row.visible_in_booking_engine === false ? "Sólo PMS" : "Motor público"}
              </small>
            </button>
          ))}
        </div>
        {!canEdit ? (
          <div style={{ marginTop: 10, padding: 9, borderRadius: 9, background: "color-mix(in srgb,var(--accent) 6%,var(--panelSolid))", fontSize: 10, color: "var(--muted)" }}>
            Modo lectura: la edición está protegida para el propietario.
          </div>
        ) : null}
      </aside>

      <section style={box}>
        {!form ? (
          <div style={{ color: "var(--muted)", fontSize: 11 }}>Elegí una política para verla.</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <small style={{ fontSize: 9, color: "var(--muted)" }}>CONFIGURACIÓN COMERCIAL</small>
                <h2 style={{ margin: "3px 0 0", fontSize: 18 }}>{form.name}</h2>
              </div>
              <label style={{ fontSize: 10, fontWeight: 800, display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={!canEdit || form.visible_in_booking_engine === false}
                  checked={Boolean(form.is_default) && form.visible_in_booking_engine !== false}
                  onChange={e => setForm({ ...form, is_default: e.target.checked })}
                />
                Predeterminada
              </label>
            </div>

            {error ? <div style={{ marginTop: 10, padding: 9, borderRadius: 9, background: "color-mix(in srgb,var(--red) 7%,var(--panelSolid))", color: "var(--red)", fontSize: 10.5 }}>{error}</div> : null}
            {notice ? <div style={{ marginTop: 10, padding: 9, borderRadius: 9, background: "color-mix(in srgb,#27a566 7%,var(--panelSolid))", color: "#247a50", fontSize: 10.5 }}>{notice}</div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>Nombre visible<input disabled={!canEdit} style={inputStyle} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>Código<input disabled={!canEdit} style={inputStyle} value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>Tipo<select disabled={!canEdit} value={form.policy_type || "custom"} onChange={e => setForm({ ...form, policy_type: e.target.value })}>{Object.entries(TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label style={{ display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>Moneda<select disabled={!canEdit} value={form.currency || currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{["ARS", "USD", "EUR", "BRL", "CLP", "UYU"].map(v => <option key={v}>{v}</option>)}</select></label>
              <label style={{ gridColumn: "1 / -1", display: "grid", gap: 5, fontSize: 10, color: "var(--muted)" }}>Descripción visible para el huésped<textarea disabled={!canEdit} rows="3" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            </div>

            <div style={{ ...box, marginTop: 12, padding: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={form.visible_in_booking_engine !== false}
                  onChange={e => setForm({ ...form, visible_in_booking_engine: e.target.checked, is_default: e.target.checked ? form.is_default : false })}
                />
                Visible en motor de reservas
              </label>
              <small style={{ display: "block", marginTop: 5, color: "var(--muted)", fontSize: 9.5 }}>
                Si la ocultás, seguirá disponible para el equipo dentro del PMS. Las políticas sólo internas no pueden ser predeterminadas del motor.
              </small>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <b style={{ fontSize: 12 }}>Cancelaciones antes de la llegada</b>
                  <small style={{ display: "block", marginTop: 2, color: "var(--muted)", fontSize: 9.5 }}>Podés crear varios tramos según los días previos al check-in.</small>
                </div>
                {canEdit ? <button type="button" onClick={() => setForm(current => ({ ...current, cancellation_rules: [...(current.cancellation_rules || []), { ...EMPTY_RULE }] }))}>+ Agregar regla</button> : null}
              </div>
              <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
                {(form.cancellation_rules || []).map((rule, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px auto", gap: 7, alignItems: "end", padding: 10, border: "1px solid var(--line)", borderRadius: 10 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 9.5, color: "var(--muted)" }}>Desde días antes<input disabled={!canEdit} type="number" min="0" value={rule.min_days_before || 0} onChange={e => updateRule(index, { min_days_before: num(e.target.value) })} /></label>
                    <label style={{ display: "grid", gap: 4, fontSize: 9.5, color: "var(--muted)" }}>Cargo<select disabled={!canEdit} value={rule.charge_type || "none"} onChange={e => updateRule(index, { charge_type: e.target.value, value: e.target.value === "none" ? 0 : rule.value || 0 })}>{Object.entries(CHARGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                    <label style={{ display: "grid", gap: 4, fontSize: 9.5, color: "var(--muted)" }}>Valor<input disabled={!canEdit || rule.charge_type === "none"} type="number" min="0" value={rule.value || 0} onChange={e => updateRule(index, { value: num(e.target.value) })} /></label>
                    {canEdit && form.cancellation_rules.length > 1 ? <button type="button" onClick={() => setForm(current => ({ ...current, cancellation_rules: current.cancellation_rules.filter((_, i) => i !== index) }))}>×</button> : <span />}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
              <ChargeEditor title="Penalidad por No Show" value={form.no_show_rule} onChange={value => setForm({ ...form, no_show_rule: value })} currency={form.currency} disabled={!canEdit} />
              <ChargeEditor title="Checkout anticipado" value={form.early_checkout_rule} onChange={value => setForm({ ...form, early_checkout_rule: value })} currency={form.currency} disabled={!canEdit} />
            </div>

            <div style={{ ...box, marginTop: 12, padding: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                <input type="checkbox" disabled={!canEdit} checked={Boolean(form.prepayment_required)} onChange={e => setForm({ ...form, prepayment_required: e.target.checked })} />
                Requiere pago anticipado / seña
              </label>
              {form.prepayment_required ? (
                <label style={{ display: "grid", gap: 5, maxWidth: 210, marginTop: 9, fontSize: 10, color: "var(--muted)" }}>
                  Porcentaje anticipado
                  <input disabled={!canEdit} type="number" min="0" max="100" value={form.prepayment_percent || 0} onChange={e => setForm({ ...form, prepayment_percent: Math.min(100, num(e.target.value)) })} />
                </label>
              ) : null}
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 9, fontSize: 10.5 }}>
                <input type="checkbox" disabled={!canEdit} checked={form.active !== false} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Política activa
              </label>
            </div>

            {canEdit ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                {form.id && !form.is_default ? <button type="button" onClick={remove} disabled={saving}>Eliminar</button> : null}
                <button type="button" onClick={save} disabled={saving} style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}>{saving ? "Guardando…" : "Guardar política"}</button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
