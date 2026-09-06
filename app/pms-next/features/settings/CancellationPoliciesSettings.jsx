"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../../../lib/supabase"
import ui from "./cancellation-policies.module.css"

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

function chargeHelp(rule, currency) {
  if (rule.charge_type === "fixed") return `Importe expresado en ${currency}.`
  if (rule.charge_type === "percent") return "Porcentaje sobre el total de la reserva."
  if (rule.charge_type === "nights") return "Cantidad de noches a tarifa de la reserva."
  return "No se cobra penalidad."
}

function ChargeEditor({ title, icon, value, onChange, currency, disabled }) {
  const rule = value || { charge_type: "none", value: 0 }
  return (
    <div className={ui.chargeCard}>
      <div><span className={ui.chargeIcon}>{icon}</span><span className={ui.chargeTitle}>{title}</span></div>
      <div className={ui.chargeFields}>
        <label className={ui.field}>
          Tipo
          <select disabled={disabled} value={rule.charge_type || "none"} onChange={e => onChange({ ...rule, charge_type: e.target.value, value: e.target.value === "none" ? 0 : rule.value || 0 })}>
            {Object.entries(CHARGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className={ui.field}>
          Valor
          <input disabled={disabled || rule.charge_type === "none"} type="number" min="0" step={rule.charge_type === "fixed" ? "1" : "0.01"} value={rule.value || 0} onChange={e => onChange({ ...rule, value: num(e.target.value) })} />
        </label>
      </div>
      <small className={ui.chargeHelp}>{chargeHelp(rule, currency)}</small>
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

  if (loading) return <div className={ui.editorPanel}>Cargando políticas de cancelación…</div>

  return (
    <div className={ui.layout}>
      <aside className={ui.sidePanel}>
        <div className={ui.sideHeader}>
          <div><small className={ui.eyebrow}>POLÍTICAS</small><h2>Cancelación</h2></div>
          {canEdit ? <button type="button" className={ui.newButton} onClick={newPolicy}>+ Nueva</button> : null}
        </div>
        <p className={ui.sideIntro}>Flexible queda predeterminada. Podés definir políticas públicas para el motor o sólo internas para el PMS.</p>
        <div className={ui.policyList}>
          {policies.map(row => (
            <button type="button" key={row.id} onClick={() => choose(row)} className={`${ui.policyButton} ${String(row.id) === String(selectedId) ? ui.policySelected : ""}`}>
              <span className={ui.policyName}>{row.name}</span>
              <span className={ui.policyMeta}>
                {row.is_default ? <span className={`${ui.chip} ${ui.chipAccent}`}>Predeterminada</span> : null}
                <span className={`${ui.chip} ${row.active ? ui.chipGreen : ""}`}>{row.active ? "Activa" : "Inactiva"}</span>
                <span className={`${ui.chip} ${row.visible_in_booking_engine === false ? ui.chipGold : ""}`}>{row.visible_in_booking_engine === false ? "Sólo PMS" : "Motor público"}</span>
              </span>
            </button>
          ))}
        </div>
        {!canEdit ? <div className={ui.readOnly}>Modo lectura: la edición está protegida para el propietario.</div> : null}
      </aside>

      <section className={ui.editorPanel}>
        {!form ? <div className={ui.empty}>Elegí una política para verla.</div> : <>
          <div className={ui.editorHeader}>
            <div><small className={ui.eyebrow}>CONFIGURACIÓN COMERCIAL</small><h2>{form.name}</h2></div>
            <label className={ui.defaultToggle}>
              <input type="checkbox" disabled={!canEdit || form.visible_in_booking_engine === false} checked={Boolean(form.is_default) && form.visible_in_booking_engine !== false} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
              Predeterminada
            </label>
          </div>

          {error ? <div className={`${ui.message} ${ui.error}`}>{error}</div> : null}
          {notice ? <div className={`${ui.message} ${ui.notice}`}>{notice}</div> : null}

          <div className={ui.formGrid}>
            <label className={ui.field}>Nombre visible<input disabled={!canEdit} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className={ui.field}>Código<input disabled={!canEdit} value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
            <label className={ui.field}>Tipo<select disabled={!canEdit} value={form.policy_type || "custom"} onChange={e => setForm({ ...form, policy_type: e.target.value })}>{Object.entries(TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className={ui.field}>Moneda<select disabled={!canEdit} value={form.currency || currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{["ARS", "USD", "EUR", "BRL", "CLP", "UYU"].map(v => <option key={v}>{v}</option>)}</select></label>
            <label className={`${ui.field} ${ui.wide}`}>Descripción visible para el huésped<textarea disabled={!canEdit} rows="3" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          </div>

          <div className={ui.softCard}>
            <label className={ui.toggleRow}>
              <input type="checkbox" disabled={!canEdit} checked={form.visible_in_booking_engine !== false} onChange={e => setForm({ ...form, visible_in_booking_engine: e.target.checked, is_default: e.target.checked ? form.is_default : false })} />
              Visible en motor de reservas
            </label>
            <small>Si la ocultás, seguirá disponible para el equipo dentro del PMS. Las políticas sólo internas no pueden ser predeterminadas del motor.</small>
          </div>

          <div className={ui.rulesSection}>
            <div className={ui.sectionHeader}>
              <div><b>Cancelaciones antes de la llegada</b><small>Podés crear varios tramos según los días previos al check-in.</small></div>
              {canEdit ? <button type="button" className={ui.ghostButton} onClick={() => setForm(current => ({ ...current, cancellation_rules: [...(current.cancellation_rules || []), { ...EMPTY_RULE }] }))}>+ Agregar regla</button> : null}
            </div>
            <div className={ui.rulesList}>
              {(form.cancellation_rules || []).map((rule, index) => (
                <div key={index} className={ui.ruleCard}>
                  <label className={ui.ruleField}>Desde días antes<input disabled={!canEdit} type="number" min="0" value={rule.min_days_before || 0} onChange={e => updateRule(index, { min_days_before: num(e.target.value) })} /></label>
                  <label className={ui.ruleField}>Cargo<select disabled={!canEdit} value={rule.charge_type || "none"} onChange={e => updateRule(index, { charge_type: e.target.value, value: e.target.value === "none" ? 0 : rule.value || 0 })}>{Object.entries(CHARGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className={ui.ruleField}>Valor<input disabled={!canEdit || rule.charge_type === "none"} type="number" min="0" value={rule.value || 0} onChange={e => updateRule(index, { value: num(e.target.value) })} /></label>
                  {canEdit && form.cancellation_rules.length > 1 ? <button type="button" className={ui.removeRule} onClick={() => setForm(current => ({ ...current, cancellation_rules: current.cancellation_rules.filter((_, i) => i !== index) }))} aria-label="Eliminar regla">×</button> : <span />}
                </div>
              ))}
            </div>
          </div>

          <div className={ui.chargeGrid}>
            <ChargeEditor title="Penalidad por No Show" icon="⊘" value={form.no_show_rule} onChange={value => setForm({ ...form, no_show_rule: value })} currency={form.currency} disabled={!canEdit} />
            <ChargeEditor title="Checkout anticipado" icon="↪" value={form.early_checkout_rule} onChange={value => setForm({ ...form, early_checkout_rule: value })} currency={form.currency} disabled={!canEdit} />
          </div>

          <div className={ui.prepayCard}>
            <div className={ui.prepayInline}>
              <label className={ui.toggleRow}>
                <input type="checkbox" disabled={!canEdit} checked={Boolean(form.prepayment_required)} onChange={e => setForm({ ...form, prepayment_required: e.target.checked })} />
                Requiere pago anticipado / seña
              </label>
            </div>
            {form.prepayment_required ? <label className={ui.prepayField}>Porcentaje anticipado<input disabled={!canEdit} type="number" min="0" max="100" value={form.prepayment_percent || 0} onChange={e => setForm({ ...form, prepayment_percent: Math.min(100, num(e.target.value)) })} /></label> : null}
            <div className={ui.activeRow}>
              <label className={ui.toggleRow}><input type="checkbox" disabled={!canEdit} checked={form.active !== false} onChange={e => setForm({ ...form, active: e.target.checked })} />Política activa</label>
            </div>
          </div>

          {canEdit ? <div className={ui.actions}>
            {form.id && !form.is_default ? <button type="button" className={ui.deleteButton} onClick={remove} disabled={saving}>Eliminar</button> : null}
            <button type="button" className={ui.saveButton} onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar política"}</button>
          </div> : null}
        </>}
      </section>
    </div>
  )
}
