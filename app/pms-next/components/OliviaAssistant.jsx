"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./OliviaAssistant.module.css"

const STARTERS = [
  "¿Cómo viene la ocupación hoy?",
  "¿Qué requiere atención ahora?",
  "¿Cómo creo una reserva?",
  "¿Qué puedo mejorar para vender más?",
]

function greeting(propertyName) {
  const property = String(propertyName || "tu alojamiento").trim()
  return `Hola, soy OlivIA. Estoy para ayudarte con ${property}: puedo leer la operación de hoy, explicarte cómo usar Habitación Llena y sugerirte próximos pasos.`
}

const photoStyle = { width: "100%", height: "100%", display: "block", objectFit: "cover", borderRadius: "inherit" }

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
    const userMessage = { id: `user-${Date.now()}`, role: "user", text: question }
    setMessages((current) => [...current, userMessage])
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
                <img src="/olivia-avatar.png" alt="" style={photoStyle}/>
              </span>
              <span>
                <small>ASISTENTE DEL PMS</small>
                <strong>OlivIA</strong>
                <em><i /> En línea</em>
              </span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.hideButton} onClick={onHide} title="Ocultar OlivIA de este dashboard">
                Ocultar
              </button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Minimizar OlivIA">
                ×
              </button>
            </div>
          </header>

          <div className={styles.messages} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${styles[message.role]}`}>
                {message.role === "assistant" ? <span className={styles.miniAvatar}><img src="/olivia-avatar.png" alt="" style={photoStyle}/></span> : null}
                <div className={`${styles.bubble} ${message.error ? styles.errorBubble : ""}`}>{message.text}</div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className={styles.starters}>
                {STARTERS.map((starter) => (
                  <button type="button" key={starter} onClick={() => ask(starter)}>
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}

            {sending ? (
              <div className={`${styles.messageRow} ${styles.assistant}`}>
                <span className={styles.miniAvatar}><img src="/olivia-avatar.png" alt="" style={photoStyle}/></span>
                <div className={`${styles.bubble} ${styles.typing}`} aria-label="OlivIA está escribiendo">
                  <i /> <i /> <i />
                </div>
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
            <button type="submit" disabled={!input.trim() || sending} aria-label="Enviar pregunta">
              ↑
            </button>
          </form>
          <footer>Lee el contexto operativo disponible en tu PMS. Las recomendaciones no ejecutan cambios por sí solas.</footer>
        </section>
      ) : null}

      {!open && nudge ? (
        <button type="button" className={styles.nudge} onClick={openAssistant}>
          <b>Hola, soy OlivIA</b>
          <span>¿Te ayudo con la operación de hoy?</span>
        </button>
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
          <img className={styles.launcherAvatar} src="/olivia-avatar.png" alt="" style={photoStyle}/>
          <span className={styles.launcherSpark}>✦</span>
        </button>
      ) : null}
    </div>
  )
}
