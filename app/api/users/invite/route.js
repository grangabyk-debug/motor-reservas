import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json(
        { error: "No estás autenticado." },
        { status: 401 }
      )
    }

    const { email, fullName, role, propertyId } =
      await request.json()

    if (!email || !role || !propertyId) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      )
    }

    const rolesPermitidos = [
      "manager",
      "reception",
      "housekeeping",
      "admin",
    ]

    if (!rolesPermitidos.includes(role)) {
      return NextResponse.json(
        { error: "El rol seleccionado no es válido." },
        { status: 400 }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const secretKey =
      process.env.SUPABASE_SECRET_KEY

    if (
      !supabaseUrl ||
      !publishableKey ||
      !secretKey
    ) {
      console.error(
        "Faltan variables de Supabase."
      )

      return NextResponse.json(
        {
          error:
            "Faltan variables de configuración del servidor.",
        },
        { status: 500 }
      )
    }

    // Cliente usando la sesión del usuario actual
    const userClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    const {
      data: { user: currentUser },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "La sesión no es válida." },
        { status: 401 }
      )
    }

    // Cliente administrativo.
    // Esta clave SOLO existe en el servidor.
    const adminClient = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Buscar el alojamiento
    const { data: property, error: propertyError } =
      await adminClient
        .from("properties")
        .select("id, name, owner_id")
        .eq("id", propertyId)
        .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "No se encontró el alojamiento." },
        { status: 404 }
      )
    }

    // Solo el propietario puede invitar usuarios
    if (property.owner_id !== currentUser.id) {
      return NextResponse.json(
        {
          error:
            "Solo el propietario puede invitar usuarios.",
        },
        { status: 403 }
      )
    }

    const emailNormalizado =
      email.trim().toLowerCase()

    // Buscar si el usuario ya existe
    const {
      data: usersData,
      error: usersError,
    } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

    if (usersError) {
      console.error(
        "Error buscando usuarios:",
        usersError
      )

      return NextResponse.json(
        {
          error:
            "No se pudieron consultar los usuarios.",
        },
        { status: 500 }
      )
    }

    const usuarioExistente =
      usersData.users.find(
        (user) =>
          user.email?.toLowerCase() ===
          emailNormalizado
      )

    let userId

    if (usuarioExistente) {
      userId = usuarioExistente.id

      const {
        data: membershipExistente,
      } = await adminClient
        .from("property_members")
        .select(
          "property_id, user_id, role"
        )
        .eq("property_id", propertyId)
        .eq("user_id", userId)
        .maybeSingle()

      if (membershipExistente) {
        return NextResponse.json(
          {
            error:
              "Ese usuario ya tiene acceso a este alojamiento.",
          },
          { status: 409 }
        )
      }
    } else {
      // Crear usuario y enviar invitación
      const {
        data: inviteData,
        error: inviteError,
      } =
        await adminClient.auth.admin.inviteUserByEmail(
          emailNormalizado
        )

      if (inviteError) {
        console.error(
          "Error invitando usuario:",
          inviteError
        )

        return NextResponse.json(
          {
            error:
              inviteError.message ||
              "No se pudo enviar la invitación.",
          },
          { status: 400 }
        )
      }

      userId = inviteData.user.id
    }

    // Crear o actualizar perfil
    const { error: profileError } =
      await adminClient
        .from("profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName || "",
            role,
          },
          {
            onConflict: "id",
          }
        )

    if (profileError) {
      console.error(
        "Error creando perfil:",
        profileError
      )

      return NextResponse.json(
        {
          error:
            "El usuario fue creado, pero no se pudo crear su perfil.",
        },
        { status: 500 }
      )
    }

    // Asociar usuario al alojamiento
    const { error: memberError } =
      await adminClient
        .from("property_members")
        .insert({
          property_id: propertyId,
          user_id: userId,
          role,
        })

    if (memberError) {
      console.error(
        "Error creando membership:",
        memberError
      )

      return NextResponse.json(
        {
          error:
            "El usuario fue creado, pero no se pudo asignar el alojamiento.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        "Usuario invitado correctamente.",
      userId,
      propertyId,
      role,
    })
  } catch (error) {
    console.error(
      "Error invitando usuario:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado.",
      },
      { status: 500 }
    )
  }
}
