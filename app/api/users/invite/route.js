import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request) {
  try {
    const body = await request.json()

    const email = body.email
    const fullName = body.fullName
    const role = body.role
    const propertyId = body.propertyId

    if (!email || !propertyId || !role) {
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
        { error: `Rol no válido: ${role}` },
        { status: 400 }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const secretKey =
      process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return NextResponse.json(
        {
          error:
            "Faltan variables de configuración del servidor.",
        },
        { status: 500 }
      )
    }

    const authorization =
      request.headers.get("authorization")

    if (!authorization) {
      return NextResponse.json(
        { error: "No estás autenticado." },
        { status: 401 }
      )
    }

    // Verificar al usuario que está haciendo la invitación
    const userClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: authorization,
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
    // SUPABASE_SECRET_KEY solamente se utiliza en el servidor.
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
    const {
      data: property,
      error: propertyError,
    } = await adminClient
      .from("properties")
      .select("id, name, owner_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      console.error("PROPERTY ERROR:", propertyError)

      return NextResponse.json(
        { error: "No se encontró el alojamiento." },
        { status: 404 }
      )
    }

    // Solo el propietario puede invitar
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
      String(email).trim().toLowerCase()

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
      console.error("USERS ERROR:", usersError)

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

      // Verificar si ya pertenece al alojamiento
      const {
        data: membershipExistente,
        error: membershipCheckError,
      } = await adminClient
        .from("property_members")
        .select(
          "property_id, user_id, role"
        )
        .eq("property_id", propertyId)
        .eq("user_id", userId)
        .maybeSingle()

      if (membershipCheckError) {
        console.error(
          "MEMBERSHIP CHECK ERROR:",
          membershipCheckError
        )

        return NextResponse.json(
          {
            error:
              "No se pudo comprobar el acceso del usuario.",
          },
          { status: 500 }
        )
      }

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
          "INVITE ERROR:",
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

    // Crear perfil
    const { error: profileError } =
      await adminClient
        .from("profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName || "",
            role: role,
          },
          {
            onConflict: "id",
          }
        )

    if (profileError) {
      console.error(
        "PROFILE ERROR:",
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
          role: role,
        })

    if (memberError) {
      console.error(
        "MEMBER ERROR:",
        memberError
      )

      return NextResponse.json(
        {
          error:
            "El usuario fue creado, pero no se pudo asignar al alojamiento.",
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
      "INVITATION ERROR:",
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Ocurrió un error inesperado.",
      },
      { status: 500 }
    )
  }
}
