# PMS Next — Grafo Operativo

## Estado

**Paquete 1 en ejecución.** Primer corte vertical: `Mensajes -> Huésped -> Reserva -> Habitación -> Pagos -> Housekeeping -> Mantenimiento`.

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

## Seguridad multitenant

El trigger `trg_inbox_conversations_context_tenant` bloquea cualquier vínculo en el que huésped, reserva o habitación no pertenezcan al mismo `property_id` de la conversación.

El RPC es `SECURITY INVOKER`, por lo que sigue las políticas RLS del usuario que lo llama. Su ejecución pública está revocada y sólo se concede a `authenticated`.

## Contrato de UI

Al abrir una conversación, Mensajes muestra un bloque compacto de **Contexto operativo** con:

- huésped reconocido;
- número/estado y fechas de reserva;
- habitación o habitaciones;
- total cobrado y saldo pendiente;
- tareas de Housekeeping abiertas;
- incidencias de Mantenimiento abiertas.

Los accesos contextuales sólo aparecen si el rol puede abrir la vista de destino:

- `Ver reserva` -> `reservations` con `reservationId`;
- `Cobros` -> `dailycash` con `cashReservationId`;
- `Housekeeping` -> `housekeeping`;
- `Mantenimiento` -> `maintenance`.

No se muestran botones de envío hasta que exista un adaptador de salida seguro. Los filtros de canal son controles reales, no decoración.

## Responsive

Desktop usa patrón maestro/detalle con contexto encima del hilo. En móvil, el hilo entra como panel y dispone de una acción explícita para volver a la lista. El contexto se reorganiza en tarjetas de dos columnas y puede desplazarse sin bloquear el hilo.

## Estados semánticos

- Verde: sin deuda / sin incidencias / habitación lista / operación correcta.
- Amarillo: saldo pendiente / housekeeping pendiente / estado que requiere atención.
- Rojo: mantenimiento abierto / bloqueo / cancelación o problema crítico.
- Neutral: datos informativos sin juicio operativo.

## Próximo corte del Paquete 1

1. Añadir vínculo desde Reserva hacia conversación relacionada.
2. Añadir retorno exacto desde tareas/incidencias hacia reserva y habitación.
3. Incorporar `guest_requests` al mismo contexto.
4. Construir timeline operativo unificado por reserva.
5. Normalizar eventos internos para que el futuro agente pueda actuar sobre contratos estables.
