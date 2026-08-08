import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { question, context } = await request.json()

    if (!question) {
      return NextResponse.json(
        { error: "Falta la pregunta." },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    // Si todavía no configuramos OpenAI,
    // el asistente funciona con respuestas básicas.
    if (!apiKey) {
      return NextResponse.json({
        answer: responderSinIA(question, context),
        mode: "local",
      })
    }

    const prompt = `
Sos el asistente hotelero de Habitación Llena.

Respondé en español argentino, de forma profesional, clara y breve.

Tu función es ayudar al administrador del alojamiento a interpretar
la información de su operación.

IMPORTANTE:
- Usá únicamente los datos proporcionados en el contexto.
- No inventes reservas.
- No inventes ingresos.
- No inventes porcentajes.
- No inventes huéspedes.
- Si falta un dato, decilo claramente.
- Podés hacer recomendaciones operativas, pero aclarando que son recomendaciones.
- Si preguntan algo que no tiene relación con la gestión hotelera,
  indicá amablemente que estás enfocado en ayudar con la operación.

Contexto actual del alojamiento:

${JSON.stringify(context, null, 2)}

Pregunta del administrador:

${question}
`

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5",
          input: prompt,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("Error OpenAI:", data)

      return NextResponse.json({
        answer: responderSinIA(question, context),
        mode: "local",
      })
    }

    return NextResponse.json({
      answer:
        data.output_text ||
        "No pude generar una respuesta en este momento.",
      mode: "openai",
    })
  } catch (error) {
    console.error("Error asistente:", error)

    return NextResponse.json(
      {
        error: "No se pudo procesar la consulta.",
      },
      {
        status: 500,
      }
    )
  }
}

function responderSinIA(question, context = {}) {
  const q = question.toLowerCase()

  const reservas = context.reservas || []
  const habitaciones = context.habitaciones || []
  const metricas = context.metricas || {}

  const habitacionesActivas = habitaciones.filter(
    (h) => h.activa !== false
  )

  const ocupadasHoy = reservas.filter(
    (r) =>
      r.estado !== "cancelada" &&
      r.entrada <= context.hoy &&
      r.salida > context.hoy
  )

  // OCUPACIÓN

  if (
    q.includes("ocupad") ||
    q.includes("ocupación") ||
    q.includes("ocupacion")
  ) {
    return `
Hoy tenés ${ocupadasHoy.length} habitación(es) ocupada(s).

Hay ${habitacionesActivas.length} habitación(es) activa(s) cargada(s) en el sistema.
`
  }

  // RESERVAS

  if (q.includes("reserva")) {
    return `
En los últimos 30 días registrás:

• ${metricas.reservas || 0} reserva(s)
• ${metricas.noches || 0} noche(s) vendida(s)
`
  }

  // NOCHES

  if (
    q.includes("noche") ||
    q.includes("noches")
  ) {
    return `
En los últimos 30 días registrás
${metricas.noches || 0} noches vendidas.
`
  }

  // INGRESOS / VENTAS

  if (
    q.includes("ingreso") ||
    q.includes("venta") ||
    q.includes("ventas") ||
    q.includes("factur")
  ) {
    if (metricas.ingresos) {
      return `
Hay $${Number(metricas.ingresos).toLocaleString(
        "es-AR"
      )} registrados en importes disponibles en las reservas.
`
    }

    return `
Todavía no hay importes económicos registrados
en las reservas.

Podemos agregar tarifas, ingresos y análisis de
rentabilidad como próximo módulo.
`
  }

  // HABITACIONES

  if (
    q.includes("habitación") ||
    q.includes("habitacion") ||
    q.includes("cuarto")
  ) {
    return `
Tenés ${habitacionesActivas.length}
habitación(es) activa(s) cargada(s).
`
  }

  // AYUDA

  return `
Puedo ayudarte a analizar la operación del alojamiento.

Por ejemplo:

• ¿Cuántas habitaciones están ocupadas hoy?
• ¿Cuántas reservas tengo?
• ¿Cuántas noches vendí?
• ¿Cuántas habitaciones tengo?
• ¿Cómo viene la ocupación?
• ¿Cuánto vendí?

Cuando conectemos los datos económicos y las OTAs,
también voy a poder ayudarte con ventas, canales,
rendimiento y recomendaciones.
`
}
