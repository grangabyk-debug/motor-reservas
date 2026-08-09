"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"

const ROLES = {
  owner: "Propietario",
  manager: "Gerente",
  reception: "Recepción",
  housekeeping: "Housekeeping",
  admin: "Administración",
}

export default function UsuariosPage() {
  const [usuario, setUsuario] = useState(null)
  const [property, setProperty] = useState(null)
  const [usuarios, setUsuarios] = useState([])

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)

  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [rol, setRol] = useState("reception")

  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError("")

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        window.location.href = "/login"
        return
      }

      setUsuario(user)

      // Buscar el alojamiento del usuario
      const { data: properties, error: propertyError } =
        await supabase
          .from("properties")
          .select("id, name, city")
          .eq("owner_id", user.id)

      if (propertyError) {
        throw propertyError
      }

      if (!properties || properties.length === 0) {
        setError(
          "No encontramos ningún alojamiento asociado a tu cuenta."
        )
        setCargando(false)
        return
      }

      // Por ahora usamos el primero.
      // Más adelante agregaremos selector multi-alojamiento.
      const currentProperty = properties[0]

      setProperty(currentProperty)

      await cargarUsuarios(currentProperty.id)
    } catch (err) {
      console.error(err)

      setError(
        "No se pudieron cargar los usuarios."
      )
    } finally {
      setCargando(false)
    }
  }

  async function cargarUsuarios(propertyId) {
    setError("")

    try {
      const {
        data: members,
        error: membersError,
      } = await supabase
        .from("property_members")
        .select("user_id, role, created_at")
        .eq("property_id", propertyId)
        .order("created_at", {
          ascending: true,
        })

      if (membersError) {
        console.error("ERROR PROPERTY_MEMBERS:", membersError)
        throw new Error(
          `property_members: ${membersError.message}`
        )
      }

      if (!members || members.length === 0) {
        setUsuarios([])
        return
      }

      const userIds = members.map(
        (member) => member.user_id
      )

      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", userIds)

      if (profilesError) {
        console.error("ERROR PROFILES:", profilesError)
        throw new Error(
          `profiles: ${profilesError.message}`
        )
      }

      const usuariosCompletos = members.map(
        (member) => {
          const profile = profiles?.find(
            (p) => p.id === member.user_id
          )

          return {
            ...member,
            profiles: profile || null,
          }
        }
      )

      setUsuarios(usuariosCompletos)
    } catch (err) {
      console.error("ERROR CARGANDO USUARIOS:", err)
      setUsuarios([])
      setError(
        err.message ||
          "No se pudieron cargar los usuarios del alojamiento."
      )
    }
  }

  async function invitarUsuario(e) {
    e.preventDefault()

    setMensaje("")
    setError("")

    if (!property) {
      setError("No hay un alojamiento seleccionado.")
      return
    }

    if (!email.trim()) {
      setError("Ingresá un email.")
      return
    }

    setGuardando(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        window.location.href = "/login"
        return
      }

      const response = await fetch(
        "/api/users/invite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            fullName: nombre.trim(),
            role: rol,
            propertyId: property.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo invitar al usuario."
        )
      }

      setMensaje(
        `Invitación enviada a ${email.trim()}.`
      )

      setNombre("")
      setEmail("")
      setRol("reception")
      setMostrarFormulario(false)

      await cargarUsuarios(property.id)
    } catch (err) {
      console.error(err)

      setError(
        err.message ||
          "No se pudo enviar la invitación."
      )
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <main style={page}>
        <div style={card}>
          <p style={muted}>
            Cargando usuarios...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={page}>
      <div style={container}>

        {/* ENCABEZADO */}

        <div style={header}>
          <div>
            <p style={eyebrow}>
              CONFIGURACIÓN
            </p>

            <h1 style={title}>
              Usuarios y permisos
            </h1>

            <p style={subtitle}>
              Administrá quién puede acceder a
              tu alojamiento y qué puede hacer.
            </p>
          </div>

          <button
            onClick={() =>
              setMostrarFormulario(
                !mostrarFormulario
              )
            }
            style={primaryButton}
          >
            + Invitar usuario
          </button>
        </div>

        {/* ALOJAMIENTO */}

        {property && (
          <div style={propertyCard}>
            <div>
              <div style={propertyLabel}>
                ALOJAMIENTO
              </div>

              <div style={propertyName}>
                {property.name}
              </div>

              {property.city && (
                <div style={propertyCity}>
                  {property.city}
                </div>
              )}
            </div>

            <div style={propertyBadge}>
              {usuarios.length} usuario
              {usuarios.length !== 1
                ? "s"
                : ""}
            </div>
          </div>
        )}

        {/* MENSAJES */}

        {mensaje && (
          <div style={successBox}>
            {mensaje}
          </div>
        )}

        {error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        {/* FORMULARIO */}

        {mostrarFormulario && (
          <form
            onSubmit={invitarUsuario}
            style={formCard}
          >
            <div style={formHeader}>
              <div>
                <h2 style={formTitle}>
                  Invitar usuario
                </h2>

                <p style={muted}>
                  La persona recibirá una
                  invitación por email.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(false)
                }
                style={closeButton}
              >
                ×
              </button>
            </div>

            <div style={formGrid}>
              <label style={label}>
                Nombre

                <input
                  value={nombre}
                  onChange={(e) =>
                    setNombre(e.target.value)
                  }
                  placeholder="Ej. María López"
                  style={input}
                />
              </label>

              <label style={label}>
                Email

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="persona@email.com"
                  style={input}
                />
              </label>

              <label style={label}>
                Rol

                <select
                  value={rol}
                  onChange={(e) =>
                    setRol(e.target.value)
                  }
                  style={input}
                >
                  <option value="manager">
                    Gerente
                  </option>

                  <option value="reception">
                    Recepción
                  </option>

                  <option value="housekeeping">
                    Housekeeping
                  </option>

                  <option value="admin">
                    Administración
                  </option>
                </select>
              </label>
            </div>

            <div style={roleInfo}>
              <strong>
                {ROLES[rol]}
              </strong>

              <span>
                {descripcionRol(rol)}
              </span>
            </div>

            <div style={formActions}>
              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(false)
                }
                style={secondaryButton}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                style={{
                  ...primaryButton,
                  opacity: guardando ? 0.6 : 1,
                }}
              >
                {guardando
                  ? "Enviando..."
                  : "Enviar invitación"}
              </button>
            </div>
          </form>
        )}

        {/* LISTA */}

        <section style={card}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                Personas con acceso
              </h2>

              <p style={muted}>
                Estos usuarios pueden acceder a
                {property
                  ? ` ${property.name}.`
                  : " tu alojamiento."}
              </p>
            </div>
          </div>

          {usuarios.length === 0 ? (
            <div style={empty}>
              <div style={emptyIcon}>
                👥
              </div>

              <strong>
                Todavía no hay usuarios adicionales
              </strong>

              <p style={muted}>
                Invitá a recepción, gerencia o
                administración para empezar.
              </p>
            </div>
          ) : (
            <div style={userList}>
              {usuarios.map((item) => {
                const esActual =
                  item.user_id === usuario?.id

                const nombreUsuario =
                  item.profiles?.full_name ||
                  "Usuario"

                return (
                  <div
                    key={item.user_id}
                    style={userRow}
                  >
                    <div style={avatar}>
                      {nombreUsuario
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div style={userInfo}>
                      <div style={userName}>
                        {nombreUsuario}

                        {esActual && (
                          <span
                            style={currentBadge}
                          >
                            Vos
                          </span>
                        )}
                      </div>

                      <div style={userId}>
                        {item.role
                          ? ROLES[item.role] ||
                            item.role
                          : "Sin rol"}
                      </div>
                    </div>

                    <div style={activeBadge}>
                      Activo
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* EXPLICACIÓN DE ROLES */}

        <section style={card}>
          <h2 style={sectionTitle}>
            Roles disponibles
          </h2>

          <div style={rolesGrid}>
            {Object.entries(ROLES).map(
              ([key, label]) => (
                <div
                  key={key}
                  style={roleCard}
                >
                  <strong>{label}</strong>

                  <span>
                    {descripcionRol(key)}
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function descripcionRol(role) {
  switch (role) {
    case "owner":
      return "Acceso completo al alojamiento y a su configuración."

    case "manager":
      return "Gestiona la operación, reservas, habitaciones y reportes."

    case "reception":
      return "Gestiona reservas, huéspedes, entradas y salidas."

    case "housekeeping":
      return "Consulta y actualiza la operación de limpieza y habitaciones."

    case "admin":
      return "Gestiona información administrativa y pagos."

    default:
      return ""
  }
}

const page = {
  minHeight: "100vh",
  background: "#f5f7fa",
  padding: "36px 32px",
  fontFamily:
    "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
}

const container = {
  maxWidth: 1100,
  margin: "0 auto",
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 24,
  marginBottom: 26,
}

const eyebrow = {
  margin: 0,
  color: "#006ce4",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.4,
}

const title = {
  margin: "6px 0 5px",
  fontSize: 30,
  color: "#111827",
}

const subtitle = {
  margin: 0,
  color: "#6b7280",
  fontSize: 14,
}

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
  boxShadow:
    "0 8px 30px rgba(0, 40, 100, 0.04)",
}

const propertyCard = {
  background:
    "linear-gradient(135deg, #003b95, #006ce4)",
  color: "#fff",
  borderRadius: 16,
  padding: "22px 24px",
  marginBottom: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

const propertyLabel = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.2,
  opacity: 0.75,
}

const propertyName = {
  fontSize: 22,
  fontWeight: 800,
  marginTop: 4,
}

const propertyCity = {
  fontSize: 13,
  opacity: 0.8,
  marginTop: 2,
}

const propertyBadge = {
  background: "rgba(255,255,255,.15)",
  border:
    "1px solid rgba(255,255,255,.25)",
  borderRadius: 999,
  padding: "8px 13px",
  fontSize: 12,
  fontWeight: 700,
}

const primaryButton = {
  border: "none",
  background: "#006ce4",
  color: "#fff",
  borderRadius: 9,
  padding: "12px 17px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
}

const secondaryButton = {
  border: "1px solid #d8dee8",
  background: "#fff",
  color: "#374151",
  borderRadius: 9,
  padding: "12px 17px",
  fontWeight: 700,
  cursor: "pointer",
}

const successBox = {
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
  borderRadius: 10,
  padding: 13,
  marginBottom: 20,
  fontSize: 13,
  fontWeight: 600,
}

const errorBox = {
  background: "#fff1f0",
  color: "#b42318",
  border: "1px solid #fecdca",
  borderRadius: 10,
  padding: 13,
  marginBottom: 20,
  fontSize: 13,
}

const formCard = {
  background: "#fff",
  border: "1px solid #dbe4ef",
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
}

const formHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 20,
}

const formTitle = {
  margin: 0,
  fontSize: 19,
}

const closeButton = {
  border: "none",
  background: "#f3f4f6",
  width: 34,
  height: 34,
  borderRadius: 8,
  fontSize: 22,
  cursor: "pointer",
}

const formGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
}

const label = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
}

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #d8dee8",
  borderRadius: 9,
  fontSize: 14,
  background: "#fff",
  color: "#111827",
}

const roleInfo = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  marginTop: 18,
  padding: 14,
  background: "#f5f8ff",
  borderRadius: 10,
  fontSize: 13,
  color: "#475467",
}

const formActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 20,
}

const sectionHeader = {
  marginBottom: 20,
}

const sectionTitle = {
  margin: 0,
  fontSize: 19,
  color: "#111827",
}

const muted = {
  color: "#6b7280",
  fontSize: 13,
  margin: "5px 0 0",
}

const userList = {
  display: "grid",
}

const userRow = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  padding: "15px 4px",
  borderTop: "1px solid #edf0f4",
}

const avatar = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: "#e8f1ff",
  color: "#006ce4",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
}

const userInfo = {
  flex: 1,
}

const userName = {
  fontWeight: 800,
  color: "#111827",
  display: "flex",
  alignItems: "center",
  gap: 7,
}

const userId = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 3,
}

const currentBadge = {
  fontSize: 10,
  background: "#eaf2ff",
  color: "#006ce4",
  padding: "3px 7px",
  borderRadius: 999,
  fontWeight: 800,
}

const activeBadge = {
  background: "#ecfdf3",
  color: "#067647",
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
}

const empty = {
  textAlign: "center",
  padding: "40px 20px",
}

const emptyIcon = {
  fontSize: 34,
  marginBottom: 10,
}

const rolesGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginTop: 18,
}

const roleCard = {
  display: "grid",
  gap: 6,
  padding: 15,
  background: "#f8fafc",
  border: "1px solid #e7ebf0",
  borderRadius: 11,
  fontSize: 13,
  color: "#475467",
}
