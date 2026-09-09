# PMS Next — Grafo Operativo

## Estado

**Paquete 1 en ejecución.** Tercer corte completado: contexto con peticiones, navegación bidireccional, eventos normalizados y timeline operativo unificado por reserva.

## Objetivo

El grafo operativo existe para que Mensajes, Reservas, Pagos, Peticiones, Housekeeping y Mantenimiento no funcionen como silos. La reserva es el eje de una estadía y cada módulo aporta hechos vinculados por IDs reales.

Esto permite que una persona —y más adelante OlivIA— pueda partir de un mensaje o de una reserva y reconstruir el estado operativo sin búsquedas manuales ni matching por nombre.

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

La migración realiza además un backfill de evento `created` para operaciones existentes que todavía no tenían historial normalizado.

La función del trigger es `SECURITY DEFINER`, pero no puede ejecutarse directamente desde `public`, `anon` ni `authenticated`; sólo se invoca mediante los triggers de PostgreSQL.

## Timeline operativo unificado

`hl_get_reservation_operational_timeline(property_id, reservation_id, limit)` entrega una secuencia cronológica con un formato único. Hoy integra:

- movimientos de `hotel_reservation_events`;
- mensajes de conversaciones vinculadas;
- eventos de peticiones del huésped;
- eventos de Housekeeping;
- eventos de Mantenimiento;
- pagos válidos de la reserva.

Cada elemento incluye, cuando corresponde:

- `source`;
- `entity_type` / `entity_id`;
- `reservation_id`;
- `room_id`;
- `event_type`;
- `title` / `detail`;
- `actor_name`;
- `created_at`;
- `payload` normalizado.

La ficha de Reserva consume este RPC para su tarjeta **Timeline operativo**. Por lo tanto la cronología visible ya no queda limitada a cambios propios de `reservas`.

## Navegación bidireccional

- `Mensajes -> Reserva`: abre la ficha exacta.
- `Reserva -> Mensajes`: abre la conversación exacta cuando existe vínculo seguro.
- `Mensajes -> Peticiones`: abre el módulo si el rol tiene permiso.
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

Los vínculos conversación/huésped/reserva/habitación siguen validándose contra el mismo `property_id`. Los RPC de lectura son `SECURITY INVOKER`, respetan RLS y no se conceden a `anon`.

## Qué habilita para OlivIA

Con esta capa el futuro agente puede recibir una intención como “el huésped de la 204 dice que no anda el aire” y trabajar sobre referencias determinísticas:

1. identificar conversación y huésped;
2. resolver reserva y habitación;
3. consultar si ya existe petición o mantenimiento;
4. revisar saldo y contexto de estadía;
5. leer el timeline para no repetir acciones;
6. crear o actualizar una acción mediante contratos estables.

Sin esta capa, la IA tendría que inferir relaciones desde texto y pantallas. Con el grafo, opera sobre datos enlazados.

## Próximo corte del Paquete 1

1. Evitar duplicados semánticos en el timeline cuando un mismo pago ya fue reflejado también como evento de reserva.
2. Agregar foco exacto de `guest_request_id` desde Mensajes/Reserva hacia Peticiones.
3. Preparar acciones seguras y auditables que OlivIA pueda invocar sobre estos contratos.
