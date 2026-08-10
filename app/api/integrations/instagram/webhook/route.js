import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const GRAPH_PROVIDER = "instagram"
const WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
const APP_SECRET =
  process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.")
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8")
  const right = Buffer.from(String(b || ""), "utf8")

  return left.length === right.length && timingSafeEqual(left, right)
}

function firmaValida(rawBody, signatureHeader) {
  if (!APP_SECRET) return false
  if (!signatureHeader?.startsWith("sha256=")) return false

  const esperado = createHmac("sha256", APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex")

  return safeEqual(signatureHeader.slice(7), esperado)
}

function extraerMensajes(payload) {
  const resultados = []

  for (const entry of payload?.entry || []) {
    for (const event of entry?.messaging || []) {
      if (!event?.message || event.message.is_echo) continue

      const senderId = event.sender?.id || null
      const recipientId = event.recipient?.id || entry?.id || null
      const messageId = event.message?.mid || null
      const texto = event.message?.text || ""

      const timestamp = event.timestamp
        ? new Date(Number(event.timestamp)).toISOString()
        : new Date().toISOString()

      resultados.push({
        instagram_account_id: String(entry?.id || recipientId || ""),
        sender_igsid: senderId ? String(senderId) : null,
        recipient_igsid: recipientId ? String(recipientId) : null,
        message_id: messageId ? String(messageId) : null,
        text: texto,
        payload: event,
        occurred_at: timestamp,
      })
    }
  }

  return resultados
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (!WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse("Webhook no configurado.", {
      status: 500,
    })
  }

  if (
    mode === "subscribe" &&
    token === WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  }

  return new NextResponse("Forbidden", {
    status: 403,
  })
}

export async function POST(request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")

  if (!firmaValida(rawBody, signature)) {
    console.warn(
      "Instagram webhook rechazado: firma inválida o secreto ausente."
    )

    return NextResponse.json(
      {
        error: "Firma inválida.",
      },
      {
        status: 401,
      }
    )
  }

  let payload

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      {
        error: "JSON inválido.",
      },
      {
        status: 400,
      }
    )
  }

  try {
    const db = adminSupabase()

    const connectionIds = [
      ...new Set(
        (payload?.entry || [])
          .map((entry) => String(entry?.id || ""))
          .filter(Boolean)
      ),
    ]

    const { data: connections, error: connectionsError } =
      connectionIds.length
        ? await db
            .from("integration_connections")
            .select("id, property_id, external_account_id")
            .eq("provider", GRAPH_PROVIDER)
            .in("external_account_id", connectionIds)
        : { data: [], error: null }

    if (connectionsError) {
      throw connectionsError
    }

    const connectionByAccount = new Map(
      (connections || []).map((connection) => [
        String(connection.external_account_id),
        connection,
      ])
    )

    const { error: eventError } = await db
      .from("instagram_webhook_events")
      .insert({
        provider: GRAPH_PROVIDER,
        object_type: payload?.object || null,
        payload,
        received_at: new Date().toISOString(),
      })

    if (eventError) {
      throw eventError
    }

    const mensajes = extraerMensajes(payload)

    for (const mensaje of mensajes) {
      const connection = connectionByAccount.get(
        mensaje.instagram_account_id
      )

      if (!connection) continue

      const conversationKey = `${connection.id}:${
        mensaje.sender_igsid || "unknown"
      }`

      const { data: conversation, error: conversationError } =
        await db
          .from("inbox_conversations")
          .upsert(
            {
              property_id: connection.property_id,
              connection_id: connection.id,
              channel: "Instagram",
              external_thread_id: conversationKey,
              external_contact_id: mensaje.sender_igsid,
              last_message_at: mensaje.occurred_at,
              last_message_text:
                mensaje.text || "[Mensaje multimedia]",
              unread_count: 1,
            },
            {
              onConflict:
                "connection_id,external_thread_id",
            }
          )
          .select("id")
          .single()

      if (conversationError) {
        throw conversationError
      }

      const { error: messageError } = await db
        .from("inbox_messages")
        .upsert(
          {
            conversation_id: conversation.id,
            external_message_id: mensaje.message_id,
            direction: "inbound",
            sender_external_id: mensaje.sender_igsid,
            text: mensaje.text,
            payload: mensaje.payload,
            occurred_at: mensaje.occurred_at,
          },
          {
            onConflict:
              "conversation_id,external_message_id",
          }
        )

      if (messageError) {
        throw messageError
      }
    }

    return NextResponse.json({
      ok: true,
      processed: mensajes.length,
    })
  } catch (error) {
    console.error("Instagram webhook error:", error)

    return NextResponse.json(
      {
        error: "No se pudo procesar el webhook.",
      },
      {
        status: 500,
      }
    )
  }
}
