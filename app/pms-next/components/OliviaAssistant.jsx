"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./OliviaAssistant.module.css"

const STARTERS = [
  "¿Cómo viene la ocupación hoy?",
  "¿Qué requiere atención ahora?",
  "¿Cómo creo una reserva?",
  "¿Qué puedo mejorar para vender más?",
]

// Embedded source pixels for OlivIA. We decode them directly into a canvas so the
// avatar does not depend on a public asset URL, browser cache or img-src CSP rules.
const OLIVIA_AVATAR_BASE64 = "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"

function greeting(propertyName) {
  const property = String(propertyName || "tu alojamiento").trim()
  return `Hola, soy OlivIA. Estoy para ayudarte con ${property}: puedo leer la operación de hoy, explicarte cómo usar Habitación Llena y sugerirte próximos pasos.`
}

function OliviaWordmark() {
  return <><span>Oliv</span><span className={styles.aiAccent}>IA</span></>
}

function paintFallback(canvas) {
  const ctx = canvas?.getContext?.("2d")
  if (!ctx) return
  canvas.width = 160
  canvas.height = 160
  ctx.clearRect(0, 0, 160, 160)
  ctx.fillStyle = "#f2e8f8"
  ctx.beginPath()
  ctx.arc(80, 80, 78, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#7c3aed"
  ctx.font = "700 48px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("IA", 80, 82)
}

function OliviaPhoto({ className = "", alt = "" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let bitmap = null

    async function paint() {
      const canvas = canvasRef.current
      if (!canvas) return

      try {
        const binary = atob(OLIVIA_AVATAR_BASE64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

        bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }))
        if (cancelled || !canvasRef.current) {
          bitmap?.close?.()
          return
        }

        const source = document.createElement("canvas")
        source.width = bitmap.width
        source.height = bitmap.height
        const sourceCtx = source.getContext("2d", { willReadFrequently: true })
        sourceCtx.drawImage(bitmap, 0, 0)

        // The tiny JPEG was created from the transparent portrait and its empty
        // pixels became black. Make only near-pure black pixels transparent again.
        const pixels = sourceCtx.getImageData(0, 0, source.width, source.height)
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i]
          const g = pixels.data[i + 1]
          const b = pixels.data[i + 2]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max < 28 && max - min < 9) pixels.data[i + 3] = 0
        }
        sourceCtx.putImageData(pixels, 0, 0)

        canvas.width = 160
        canvas.height = 160
        const ctx = canvas.getContext("2d")
        ctx.clearRect(0, 0, 160, 160)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(source, 0, 0, 160, 160)
      } catch (error) {
        console.error("OlivIA avatar render failed", error)
        paintFallback(canvas)
      } finally {
        bitmap?.close?.()
      }
    }

    paint()
    return () => {
      cancelled = true
      bitmap?.close?.()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : "true"}
    />
  )
}

export default function OliviaAssistant({ propertyId, propertyName, context, onHide }) {
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState(() => [
    { id: "welcome", role: "assistant", text: greeting(propertyName) },
  ])
  const endRef = useRef(null)

  useEffect(() => {
    setMessages([{ id: `welcome-${propertyId || "default"}`, role: "assistant", text: greeting(propertyName) }])
    setInput("")
    setSending(false)
  }, [propertyId, propertyName])

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, open, sending])

  async function ask(rawQuestion) {
    const question = String(rawQuestion || "").trim()
    if (!question || sending) return

    const history = messages
      .filter((message) => !message.error)
      .slice(-8)
      .map((message) => ({ role: message.role, text: message.text }))

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: question }])
    setInput("")
    setSending(true)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, history }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No pude responder en este momento.")

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data?.answer || "No pude generar una respuesta en este momento.",
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: error?.message || "No pude conectarme. Probá de nuevo en unos segundos.",
          error: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    ask(input)
  }

  function openAssistant() {
    setOpen(true)
    setNudge(false)
  }

  return (
    <div className={styles.root}>
      {open ? (
        <section className={styles.panel} aria-label="OlivIA, asistente de Habitación Llena">
          <header className={styles.header}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">
                <OliviaPhoto className={styles.avatarImage} />
              </span>
              <span>
                <small>ASISTENTE DEL PMS</small>
                <strong><OliviaWordmark /></strong>
                <em><i /> En línea</em>
              </span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.hideButton} onClick={onHide} title="Ocultar OlivIA de este dashboard">Ocultar</button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Minimizar OlivIA">×</button>
            </div>
          </header>

          <div className={styles.messages} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${styles[message.role]}`}>
                {message.role === "assistant" ? (
                  <span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span>
                ) : null}
                <div className={`${styles.bubble} ${message.error ? styles.errorBubble : ""}`}>{message.text}</div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className={styles.starters}>
                {STARTERS.map((starter) => (
                  <button type="button" key={starter} onClick={() => ask(starter)}>{starter}</button>
                ))}
              </div>
            ) : null}

            {sending ? (
              <div className={`${styles.messageRow} ${styles.assistant}`}>
                <span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span>
                <div className={`${styles.bubble} ${styles.typing}`} aria-label="OlivIA está escribiendo"><i /> <i /> <i /></div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  if (input.trim() && !sending) ask(input)
                }
              }}
              placeholder="Preguntale algo sobre tu hotel…"
              aria-label="Pregunta para OlivIA"
            />
            <button type="submit" disabled={!input.trim() || sending} aria-label="Enviar pregunta">↑</button>
          </form>
          <footer>Lee el contexto operativo disponible en tu PMS. Las recomendaciones no ejecutan cambios por sí solas.</footer>
        </section>
      ) : null}

      {!open && nudge ? (
        <div className={styles.nudge} role="status">
          <button type="button" className={styles.nudgeOpen} onClick={openAssistant} aria-label="Abrir OlivIA">
            <span>Hola, soy <OliviaWordmark /></span>
            <small>¿En qué puedo ayudarte?</small>
          </button>
          <button type="button" className={styles.nudgeClose} onClick={() => setNudge(false)} aria-label="Cerrar saludo de OlivIA">×</button>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          className={styles.launcher}
          onClick={openAssistant}
          aria-label="Abrir OlivIA"
          aria-expanded={open}
          title="OlivIA · Asistente hotelero"
        >
          <OliviaPhoto className={styles.launcherImage} alt="OlivIA" />
          <span className={styles.onlineDot} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
