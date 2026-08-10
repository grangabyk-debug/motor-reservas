# Habitación Llena — arquitectura multi-tenant y seguridad

## Objetivo

Un usuario solo puede leer o modificar información de las propiedades a las que está asociado mediante `property_members`. La separación entre clientes debe existir en la base de datos, no solamente en el frontend.

## Modelo objetivo

```text
users (Supabase Auth)
   │
   ├── property_members ──► properties
   │                           │
   │                           ├── units
   │                           ├── reservations
   │                           ├── payments
   │                           ├── blocks
   │                           ├── integrations
   │                           └── inbox
   │
   └── profiles
```

Las tablas legacy (`alojamientos`, `habitaciones`, `reservas`, `bloqueos`, `pagos`) ya tienen `property_id` para mantener compatibilidad durante la transición.

## Regla de seguridad principal

El frontend puede filtrar datos para mejorar UX, pero **nunca es la barrera de seguridad**. La barrera real es RLS en Supabase:

- `SELECT`: solo miembros de la propiedad.
- `INSERT/UPDATE`: según el rol (`owner`, `manager`, `reception`, `housekeeping`).
- `DELETE`: limitado a los roles de gestión cuando corresponde.
- Nunca confiar en un `user_id` enviado por el navegador para decidir el tenant.
- Nunca usar una clave secreta de Supabase en el navegador.

## Estado actual

La aplicación ya consulta `property_members` para determinar las propiedades accesibles y la base tiene políticas RLS basadas en `property_id`. El siguiente paso es eliminar progresivamente la dependencia del filtro por nombre de alojamiento que todavía existe en la capa legacy del dashboard.

## Plan de migración seguro

1. Mantener `main` intacta.
2. Trabajar en `refactor/multi-tenant-pms`.
3. Migrar las lecturas del dashboard a `property_id` explícito.
4. Migrar escrituras para que el `property_id` sea obligatorio y nunca provenga de un tenant seleccionado arbitrariamente por el cliente.
5. Mantener tablas legacy mientras se valida todo el PMS.
6. Probar aislamiento entre dos usuarios y dos propiedades.
7. Ejecutar build de Next.js.
8. Crear Preview en Vercel.
9. Probar login, calendario, reservas, check-in/out, bloqueos, pagos, housekeeping y bandeja.
10. Recién después abrir/mergear el PR a `main`.

## Casos de prueba de aislamiento

### Usuario A

Debe poder ver solamente propiedades donde existe un registro en `property_members` para A.

### Usuario B

Debe poder ver solamente propiedades donde existe un registro en `property_members` para B.

### Intento de acceso cruzado

Si A intenta consultar directamente una reserva, habitación, pago, bloqueo, conversación o integración perteneciente a una propiedad de B, Supabase debe devolver cero filas o rechazar la operación por RLS.

### Intento de escritura cruzada

Aunque A manipule las herramientas del navegador y cambie manualmente un `property_id`, la operación debe fallar por RLS.

## Seguridad adicional pendiente

- Activar protección de contraseñas filtradas de Supabase Auth.
- Revisar periódicamente Security Advisors.
- Revisar políticas RLS después de cada nueva tabla.
- Mantener secretos exclusivamente en variables de entorno server-side.
- No guardar números completos de tarjetas ni CVV. Solo conservar datos de garantía estrictamente necesarios.
- Revisar Storage: los documentos de huéspedes deben usar buckets privados y URLs firmadas, nunca URLs públicas.
- Agregar rate limiting a endpoints sensibles.
- Auditar permisos por rol antes de habilitar nuevas funciones.
