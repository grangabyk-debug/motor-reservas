# PMS Next — Grafo Operativo

## Estado

**Paquete 1 en ejecución.** Segundo corte completado: el grafo ya navega en ambos sentidos entre `Mensajes <-> Reserva` y desde Housekeeping/Mantenimiento vuelve por IDs reales a la reserva y habitación de origen.

## Regla de diseño de datos

No existe una copia de cada entidad dentro de Mensajes. La conversación conserva referencias estables y el contexto se resuelve desde las fuentes canónicas:

```text
inbox_conversations
  -> guest_profile_id -> hotel_guest_profiles
  -> reservation_id   -> reservas
                         -> guest_profile_id
                         -> habitacion_id / habitaciones_ids
                         -> pagos
                         -> hotel_housekeeping_tasks
                         -> hotel_maintenance_tickets
  -> room_id          -> habitaciones
```

La **reserva** es el eje operativo de la estadía. El **perfil de huésped** es el eje CRM. La conversación sólo guarda vínculos; no duplica saldos, estados de habitación ni tareas.

## Resolución automática

`hl_get_inbox_operational_context(property_id, conversation_id)`:

1. Reutiliza IDs ya vinculados.
2. Si falta huésped, intenta coincidencia exacta de email o teléfono normalizado.
3. Si falta reserva, busca reservas de la misma propiedad asociadas al perfil/email/teléfono.
4. Prioriza la estadía que contiene la fecha del mensaje, luego la próxima y finalmente la pasada más cercana.
5. Persiste los IDs resueltos para no repetir búsquedas textuales en cada uso.
6. Devuelve contexto agregado de huésped, reserva, habitaciones, saldo/pagos, housekeeping y mantenimiento.

**No se vincula por similitud de nombre.** Un nombre parecido no es evidencia suficiente.

## Lookup inverso Reserva -> Conversación

`hl_get_reservation_conversation(property_id, reservation_id)` resuelve la relación en sentido inverso:

1. Si ya existe una conversación vinculada a esa reserva, devuelve la más reciente.
2. Nunca reutiliza una conversación que ya pertenezca a otra reserva.
3. Para conversaciones todavía sin `reservation_id`, sólo considera la misma propiedad y coincidencias exactas de `guest_profile_id`, email o teléfono normalizado.
4. Prioriza conversaciones temporalmente cercanas a la estadía.
5. Antes de devolver una candidata la pasa por `hl_get_inbox_operational_context`; sólo se acepta si el resolvedor canónico termina en la misma reserva solicitada.

Así, la ficha de Reserva puede mostrar `Mensajes` sin implementar una segunda lógica de matching distinta a la del Inbox.

## Seguridad multitenant

El trigger `trg_inbox_conversations_context_tenant` bloquea cualquier vínculo en el que huésped, reserva o habitación no pertenezcan al mismo `property_id` de la conversación.

Los RPC del grafo son `SECURITY INVOKER`, por lo que siguen las políticas RLS del usuario que los llama. Su ejecución pública está revocada y sólo se concede a `authenticated`.

## Navegación bidireccional

- `Mensajes -> Reserva`: abre `reservations` con el `reservationId` exacto.
- `Reserva -> Mensajes`: la pestaña contextual Mensajes aparece sólo para roles habilitados y abre el `conversation_id` exacto.
- `Mensajes -> Housekeeping`: si hay habitación vinculada, lleva el `room_id` como foco.
- `Mantenimiento -> Reserva`: abre la ficha exacta de la reserva si el rol tiene permiso.
- `Mantenimiento -> Habitación`: abre Housekeeping con la habitación exacta resaltada si el rol puede acceder.
- `Housekeeping -> Reserva`: desde la cola operativa vuelve a la ficha exacta cuando existe `reservation_id` y el rol tiene permiso.
- `Housekeeping -> Habitación`: lleva al card exacto dentro de la misma vista y lo resalta temporalmente.

Los focos contextuales se transportan como parámetros transitorios y se consumen al llegar; no crean nuevas rutas ni duplican workspaces.

## Contrato de UI

Al abrir una conversación, Mensajes muestra un bloque compacto de **Contexto operativo** con:

- huésped reconocido;
- número/estado y fechas de reserva;
- habitación o habitaciones;
- total cobrado y saldo pendiente;
- tareas de Housekeeping abiertas;
- incidencias de Mantenimiento abiertas.

Los accesos contextuales sólo aparecen si el rol puede abrir la vista de destino. La ficha de Reserva tampoco consulta ni muestra metadata de conversaciones cuando `messages` no está permitido para ese rol.

No se muestran botones de envío hasta que exista un adaptador de salida seguro. Los filtros de canal son controles reales, no decoración.

## Responsive

Desktop usa patrón maestro/detalle con contexto encima del hilo. En móvil, el hilo entra como panel y dispone de una acción explícita para volver a la lista. El contexto se reorganiza en tarjetas de dos columnas y puede desplazarse sin bloquear el hilo.

Cuando una navegación apunta a una habitación concreta de Housekeeping, el card se desplaza al centro del viewport y recibe un resaltado corto para explicar continuidad sin depender de hover.

## Estados semánticos

- Verde: sin deuda / sin incidencias / habitación lista / operación correcta.
- Amarillo: saldo pendiente / housekeeping pendiente / estado que requiere atención.
- Rojo: mantenimiento abierto / bloqueo / cancelación o problema crítico.
- Neutral: datos informativos sin juicio operativo.

## Próximo corte del Paquete 1

1. Incorporar `guest_requests` al mismo `OperationalContext`.
2. Construir timeline operativo unificado por reserva/habitación.
3. Normalizar eventos internos para que el futuro agente pueda actuar sobre contratos estables.
