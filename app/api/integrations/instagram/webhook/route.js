import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const GRAPH_PROVIDER = "instagram"
const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v26.0"
const WEBHOOK_VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
const APP_SECRET =
  process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET

const INSTAGRAM_ACCESS_TOKEN =
  process.env.INSTAGRAM_ACCESS_TOKEN ||
  process.env.META_INSTAGRAM_ACCESS_TOKEN ||
  process.env.META_IG_ACCESS_TOKEN

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

async function autenticarUsuario(request) {
  const authorization = request.headers.get("authorization") || ""
  if (!authorization.startsWith("Bearer ")) return null

  const accessToken = authorization.slice(7).trim()
  if (!accessToken) return null

  const db = adminSupabase()
  const { data, error } = await db.auth.getUser(accessToken)

  if (error || !data?.user) return null
  return data.user
}

async function propiedadesAccesibles(db, userId) {
  const { data, error } = await db
    .from("property_members")
    .select("property_id")
    .eq("user_id", userId)

  if (error) throw error

  return (data || [])
    .map((item) => item.property_id)
    .filter(Boolean)
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

async function listarBandeja(request) {
  const user = await autenticarUsuario(request)

  if (!user) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 }
    )
  }

  const db = adminSupabase()
  const propertyIds = await propiedadesAccesibles(db, user.id)

  if (!propertyIds.length) {
    return NextResponse.json({ conversations: [] })
  }

  const { data: conversations, error: conversationsError } =
    await db
      .from("inbox_conversations")
      .select(
        "id, property_id, connection_id, channel, external_thread_id, external_contact_id, last_message_at, last_message_text, unread_count"
      )
      .in("property_id", propertyIds)
      .eq("channel", "Instagram")
      .order("last_message_at", { ascending: false })

  if (conversationsError) throw conversationsError

  const ids = (conversations || [])
    .map((conversation) => conversation.id)
    .filter(Boolean)

  let messages = []

  if (ids.length) {
    const { data, error } = await db
      .from("inbox_messages")
      .select(
        "id, conversation_id, external_message_id, direction, sender_external_id, text, occurred_at, payload"
      )
      .in("conversation_id", ids)
      .order("occurred_at", { ascending: true })

    if (error) throw error

    messages = data || []
  }

  const messagesByConversation = new Map()

  for (const message of messages) {
    const list =
      messagesByConversation.get(message.conversation_id) || []

    list.push({
      id: message.id,
      autor:
        message.direction === "outbound"
          ? "hotel"
          : "huesped",
      texto:
        message.text || "[Mensaje multimedia]",
      fecha: message.occurred_at,
      externalMessageId: message.external_message_id,
      payload: message.payload,
    })

    messagesByConversation.set(
      message.conversation_id,
      list
    )
  }

  const result = (conversations || []).map((conversation) => {
    const contactId =
      String(conversation.external_contact_id || "")

    return {
      id: conversation.id,
      propertyId: conversation.property_id,
      connectionId: conversation.connection_id,
      canal: "Instagram",
      nombre: contactId
        ? `Instagram · ${contactId.slice(-6)}`
        : "Consulta de Instagram",
      instagramContactId: contactId,
      noLeida:
        Number(conversation.unread_count || 0) > 0,
      ultimoMensaje:
        conversation.last_message_text || "",
      fechaUltimoMensaje:
        conversation.last_message_at,
      mensajes:
        messagesByConversation.get(conversation.id) || [],
    }
  })

  return NextResponse.json({
    conversations: result,
  })
}

async function marcarLeida(request, body) {
  const user = await autenticarUsuario(request)

  if (!user) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 }
    )
  }

  const conversationId =
    String(body?.conversation_id || "")

  if (!conversationId) {
    return NextResponse.json(
      { error: "Falta conversation_id." },
      { status: 400 }
    )
  }

  const db = adminSupabase()
  const propertyIds =
    await propiedadesAccesibles(db, user.id)

  const { data: conversation, error: conversationError } =
    await db
      .from("inbox_conversations")
      .select("id, property_id")
      .eq("id", conversationId)
      .in("property_id", propertyIds)
      .maybeSingle()

  if (conversationError) throw conversationError

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada." },
      { status: 404 }
    )
  }

  const { error } = await db
    .from("inbox_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversation.id)

  if (error) throw error

  return NextResponse.json({ ok: true })
}

async function enviarMensaje(request, body) {
  const user = await autenticarUsuario(request)

  if (!user) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 }
    )
  }

  const conversationId =
    String(body?.conversation_id || "")

  const text =
    String(body?.text || "").trim()

  if (!conversationId || !text) {
    return NextResponse.json(
      { error: "Faltan conversation_id o text." },
      { status: 400 }
    )
  }

  if (!INSTAGRAM_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno de Vercel.",
      },
      { status: 500 }
    )
  }

  const db = adminSupabase()

  const propertyIds =
    await propiedadesAccesibles(db, user.id)

  const { data: conversation, error: conversationError } =
    await db
      .from("inbox_conversations")
      .select(
        "id, property_id, connection_id, channel, external_contact_id"
      )
      .eq("id", conversationId)
      .in("property_id", propertyIds)
      .eq("channel", "Instagram")
      .maybeSingle()

  if (conversationError) throw conversationError

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada." },
      { status: 404 }
    )
  }

  const recipientId =
    String(conversation.external_contact_id || "")

  if (!recipientId) {
    return NextResponse.json(
      {
        error:
          "La conversación no tiene un Instagram Scoped ID de destinatario.",
      },
      { status: 400 }
    )
  }

  const { data: connection, error: connectionError } =
    await db
      .from("integration_connections")
      .select(
        "id, property_id, external_account_id"
      )
      .eq("id", conversation.connection_id)
      .eq("provider", GRAPH_PROVIDER)
      .maybeSingle()

  if (connectionError) throw connectionError

  if (!connection) {
    return NextResponse.json(
      {
        error:
          "No se encontró la conexión de Instagram.",
      },
      { status: 404 }
    )
  }

  const instagramAccountId =
    String(connection.external_account_id || "")

  if (!instagramAccountId) {
    return NextResponse.json(
      {
        error:
          "La conexión de Instagram no tiene external_account_id.",
      },
      { status: 500 }
    )
  }

  const graphUrl =
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramAccountId}/messages`

  const graphResponse = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: {
        id: recipientId,
      },
      message: {
        text,
      },
    }),
  })

  const graphData =
    await graphResponse.json().catch(() => ({}))

  if (!graphResponse.ok) {
    console.error(
      "Instagram Graph send error:",
      graphData
    )

    return NextResponse.json(
      {
        error:
          graphData?.error?.message ||
          "Instagram rechazó el mensaje.",
        details:
          graphData?.error?.code || null,
      },
      {
        status:
          graphResponse.status || 502,
      }
    )
  }

  const occurredAt =
    new Date().toISOString()

  const externalMessageId =
    graphData?.message_id || null

  const { error: messageError } =
    await db
      .from("inbox_messages")
      .insert({
        conversation_id:
          conversation.id,
        external_message_id:
          externalMessageId,
        direction: "outbound",
        sender_external_id:
          instagramAccountId,
        text,
        payload: graphData,
        occurred_at: occurredAt,
      })

  if (messageError) throw messageError

  const { error: updateError } =
    await db
      .from("inbox_conversations")
      .update({
        last_message_at: occurredAt,
        last_message_text: text,
        unread_count: 0,
      })
      .eq("id", conversation.id)

  if (updateError) throw updateError

  return NextResponse.json({
    ok: true,
    message_id: externalMessageId,
    recipient_id:
      graphData?.recipient_id ||
      recipientId,
  })
}

export async function GET(request) {
  const { searchParams } =
    new URL(request.url)

  const mode =
    searchParams.get("hub.mode")

  const token =
    searchParams.get("hub.verify_token")

  const challenge =
    searchParams.get("hub.challenge")

  if (mode || token || challenge) {
    if (!WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(
        "Webhook no configurado.",
        { status: 500 }
      )
    }

    if (
      mode === "subscribe" &&
      token === WEBHOOK_VERIFY_TOKEN &&
      challenge
    ) {
      return new NextResponse(
        challenge,
        {
          status: 200,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        }
      )
    }

    return new NextResponse(
      "Forbidden",
      { status: 403 }
    )
  }

  try {
    return await listarBandeja(request)
  } catch (error) {
    console.error(
      "Instagram inbox GET error:",
      error
    )

    return NextResponse.json(
      {
        error:
          "No se pudo cargar la bandeja de Instagram.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  const rawBody =
    await request.text()

  let body = null

  try {
    body = JSON.parse(rawBody)
  } catch {
    body = null
  }

  if (body?.action === "send_message") {
    try {
      return await enviarMensaje(
        request,
        body
      )
    } catch (error) {
      console.error(
        "Instagram send error:",
        error
      )

      return NextResponse.json(
        {
          error:
            "No se pudo enviar el mensaje de Instagram.",
        },
        { status: 500 }
      )
    }
  }

  if (body?.action === "mark_read") {
    try {
      return await marcarLeida(
        request,
        body
      )
    } catch (error) {
      console.error(
        "Instagram mark read error:",
        error
      )

      return NextResponse.json(
        {
          error:
            "No se pudo marcar la conversación como leída.",
        },
        { status: 500 }
      )
    }
  }

  const signature =
    request.headers.get(
      "x-hub-signature-256"
    )

  if (!firmaValida(
    rawBody,
    signature
  )) {
    console.warn(
      "Instagram webhook rechazado: firma inválida o secreto ausente."
    )

    return NextResponse.json(
      {
        error: "Firma inválida.",
      },
      { status: 401 }
    )
  }

  if (!body) {
    return NextResponse.json(
      {
        error: "JSON inválido.",
      },
      { status: 400 }
    )
  }

  try {
    const db = adminSupabase()

    const connectionIds = [
      ...new Set(
        (body?.entry || [])
          .map((entry) =>
            String(entry?.id || "")
          )
          .filter(Boolean)
      ),
    ]

    const {
      data: connections,
      error: connectionsError,
    } = connectionIds.length
      ? await db
          .from(
            "integration_connections"
          )
          .select(
            "id, property_id, external_account_id"
          )
          .eq(
            "provider",
            GRAPH_PROVIDER
          )
          .in(
            "external_account_id",
            connectionIds
          )
      : {
          data: [],
          error: null,
        }

    if (connectionsError) {
      throw connectionsError
    }

    const connectionByAccount =
      new Map(
        (connections || []).map(
          (connection) => [
            String(
              connection.external_account_id
            ),
            connection,
          ]
        )
      )

    const { error: eventError } =
      await db
        .from(
          "instagram_webhook_events"
        )
        .insert({
          provider:
            GRAPH_PROVIDER,
          object_type:
            body?.object || null,
          payload: body,
          received_at:
            new Date().toISOString(),
        })

    if (eventError) {
      throw eventError
    }

    const mensajes =
      extraerMensajes(body)

    for (const mensaje of mensajes) {
      const connection =
        connectionByAccount.get(
          mensaje.instagram_account_id
        )

      if (!connection) continue

      const conversationKey =
        `${connection.id}:${mensaje.sender_igsid || "unknown"}`

      const {
        data: conversation,
        error: conversationError,
      } = await db
        .from(
          "inbox_conversations"
        )
        .upsert(
          {
            property_id:
              connection.property_id,
            connection_id:
              connection.id,
            channel:
              "Instagram",
            external_thread_id:
              conversationKey,
            external_contact_id:
              mensaje.sender_igsid,
            last_message_at:
              mensaje.occurred_at,
            last_message_text:
              mensaje.text ||
              "[Mensaje multimedia]",
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

      const {
        error: messageError,
      } = await db
        .from(
          "inbox_messages"
        )
        .upsert(
          {
            conversation_id:
              conversation.id,
            external_message_id:
              mensaje.message_id,
            direction:
              "inbound",
            sender_external_id:
              mensaje.sender_igsid,
            text:
              mensaje.text,
            payload:
              mensaje.payload,
            occurred_at:
              mensaje.occurred_at,
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
      processed:
        mensajes.length,
    })
  } catch (error) {
    console.error(
      "Instagram webhook error:",
      error
    )

    return NextResponse.json(
      {
        error:
          "No se pudo procesar el webhook.",
      },
      { status: 500 }
    )
  }
}
