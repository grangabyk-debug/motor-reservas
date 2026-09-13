# PMS Next — Grafo Operativo

## Estado

**Paquete 1 completado.** El grafo operativo ya conecta Mensajes, Reservas, Pagos, Peticiones, Housekeeping y Mantenimiento, y OlivIA puede preparar acciones operativas seguras que requieren aprobación humana antes de ejecutarse.

## Objetivo

El grafo operativo evita que Mensajes, Reservas, Pagos, Peticiones, Housekeeping y Mantenimiento funcionen como silos. La reserva es el eje de una estadía y cada módulo aporta hechos vinculados por IDs reales.

Esto permite que una persona —y OlivIA— pueda partir de un mensaje o de una reserva y reconstruir el estado operativo sin búsquedas manuales ni matching por nombre.

## Regla de diseño de datos

```text
inbox_conversations
  -> guest_profile_id -> hotel_guest_profiles
  -> reservation_id   -> reservas
                         -> guest_profile_id
                         -> habitacion_id / habitaciones_ids
                         -> pagos
                         -> hotel_guest_requests
                         -> hotel_housekeeping_tasks
                         -> hotel_maintenance_tickets
  -> room_id          -> habitaciones
```

No se duplican saldos, estados de habitación, peticiones ni tareas dentro de Mensajes. Se conservan referencias y se consulta cada fuente canónica.

## Resolución automática

`hl_get_inbox_operational_context(property_id, conversation_id)` mantiene el vínculo canónico huésped/reserva/habitación mediante IDs existentes y coincidencias exactas de email o teléfono normalizado. No se vincula por similitud de nombre.

`hl_get_inbox_operational_context_v2(property_id, conversation_id)` extiende ese contexto sin cambiar la lógica de matching y agrega `guest_requests` abiertas de la reserva resuelta.

`hl_get_reservation_conversation(property_id, reservation_id)` resuelve la relación inversa Reserva -> Conversación y reutiliza el mismo resolvedor antes de aceptar una conversación todavía no vinculada.

## Eventos normalizados

`hl_operational_event_trigger()` registra un contrato común en `hotel_operational_events` para:

- `hotel_guest_requests`;
- `hotel_housekeeping_tasks`;
- `hotel_maintenance_tickets`.

Se registran eventos `created`, `status_changed`, `assigned` y `priority_changed`, con metadata estable que incluye cuando corresponde `reservation_id`, `room_id`, etiqueta, prioridad y responsable.

La función del trigger es `SECURITY DEFINER`, pero no puede ejecutarse directamente desde `public`, `anon` ni `authenticated`; sólo se invoca mediante los triggers de PostgreSQL.

## Timeline operativo unificado

`hl_get_reservation_operational_timeline(property_id, reservation_id, limit)` entrega una secuencia cronológica con un formato único. Integra:

- movimientos de `hotel_reservation_events`;
- mensajes de conversaciones vinculadas;
- eventos de peticiones del huésped;
- eventos de Housekeeping;
- eventos de Mantenimiento;
- pagos válidos de la reserva.

Cada elemento incluye, cuando corresponde, `source`, `entity_type`, `entity_id`, `reservation_id`, `room_id`, `event_type`, `title`, `detail`, `actor_name`, `created_at` y `payload` normalizado.

### Deduplicación de pagos

Cuando un pago de `pagos` ya está representado por un evento `payment_added` con el mismo `payment_id`, el timeline omite únicamente la fila cruda duplicada. Los eventos posteriores, como `payment_changed` o `payment_reconciled`, se conservan porque representan hechos históricos distintos.

## Navegación bidireccional y foco exacto

- `Mensajes -> Reserva`: abre la ficha exacta.
- `Reserva -> Mensajes`: abre la conversación exacta cuando existe vínculo seguro.
- `Mensajes -> Peticiones`: cuando existe una petición concreta, transporta su `guest_request_id` y la enfoca.
- `Reserva -> Peticiones`: el timeline muestra **Abrir petición** en eventos de `guest_request` y lleva al registro exacto.
- `Reserva -> Peticiones` sin evento puntual: conserva el contexto de la reserva y enfoca una petición activa asociada.
- `Mensajes -> Housekeeping`: lleva la habitación como foco cuando existe.
- `Mantenimiento -> Reserva / Habitación`: vuelve por IDs reales.
- `Housekeeping -> Reserva / Habitación`: vuelve a la reserva o enfoca el card exacto.

Los accesos contextuales sólo aparecen cuando el rol puede abrir la vista de destino.

## Contexto visible en Mensajes

El bloque de Contexto operativo muestra actualmente:

- huésped;
- estadía;
- habitación/es;
- saldo y cobros;
- peticiones abiertas;
- Housekeeping pendiente;
- Mantenimiento abierto.

## Seguridad multitenant

Los vínculos conversación/huésped/reserva/habitación siempre se validan contra el mismo `property_id`. Los RPC de lectura respetan RLS y no se conceden a `anon`.

## OlivIA — acciones operativas seguras

OlivIA ya no se limita a responder preguntas. Puede **preparar** una acción operativa cuando el usuario se lo pide explícitamente.

Flujo:

```text
Usuario pide una acción
  -> OlivIA devuelve una intención estructurada
  -> API valida sesión y propiedad activa
  -> API consulta reservas/habitaciones reales de esa propiedad
  -> allowlist + validación de IDs
  -> hl_olivia_propose_action(...)
  -> acción = proposed
  -> usuario Rechaza o Aprueba
  -> hl_olivia_approve_action(...)
  -> si fue aprobada, usuario toca Ejecutar
  -> hl_olivia_execute_action(...)
  -> PostgreSQL vuelve a validar propiedad, rol e IDs
  -> se crea/modifica la entidad canónica
  -> acción = executed o failed con resultado auditable
```

### Acciones visibles en la interfaz en este corte

- `create_guest_request`: registrar una petición del huésped.
- `create_maintenance_ticket`: crear una incidencia/tarea de mantenimiento.

Los contratos de base también soportan `update_guest_request_status` y `update_maintenance_status`, pero por ahora no se exponen al modelo ni a la tarjeta de chat. Se mantienen como capacidad backend preparada para una siguiente ampliación controlada.

### Reglas de seguridad de OlivIA

- No existe SQL libre ni escritura genérica desde la IA.
- La API usa la sesión Supabase del usuario real.
- El usuario debe pertenecer a la propiedad activa.
- `reservation_id`, `room_id` y `assigned_to` se validan contra esa misma propiedad.
- Una acción recién creada queda en `proposed` y no modifica la operación.
- Sólo un rol operativo autorizado puede aprobar/rechazar.
- Ejecutar requiere estado `approved`; PostgreSQL rechaza cualquier ejecución directa de una propuesta.
- La tabla `hotel_ai_action_requests` es de sólo lectura para clientes autenticados; no tiene INSERT/UPDATE/DELETE directo.
- La ejecución vuelve a validar todo antes de tocar Peticiones o Mantenimiento.
- Se guarda quién pidió, revisó y ejecutó la acción, junto con timestamps, destino y resultado.

## Resultado del Paquete 1

El PMS ya puede reconstruir una estadía mediante referencias determinísticas y OlivIA puede convertir una intención humana en una propuesta operativa verificable sin recibir permisos abiertos sobre la base.

Ejemplo: “Registrá una cuna para la reserva 123” puede terminar en una tarjeta de **Petición** pendiente de aprobación. “Reportá que no funciona el aire de la habitación 204” puede terminar en una tarjeta de **Mantenimiento**. Si faltan datos suficientes, OlivIA pregunta en vez de inventarlos.

## Próximo corte sugerido

Extender la misma arquitectura a cambios de estado y otras acciones del PMS de manera gradual, siempre con contratos explícitos, permisos por rol, confirmación humana cuando corresponda y auditoría completa.
