# PMS Next — Portal de Estadía del Huésped

## Objetivo

Dar a cada huésped una mini web mobile, privada y temporal durante su estadía. El portal pertenece a una sola reserva y una sola propiedad (tenant). No existe navegación por IDs de otras reservas.

## Acceso

Recepción genera un token opaco mediante `hl_guest_stay_portal_issue(reservation_id)`. La base guarda únicamente el hash. El link usa `/stay/<token>` y deja de funcionar cuando la reserva se cancela/finaliza, se registra check-out real, se revoca el portal o vence su ventana.

## Contenido v1

- nombre/logo del hotel y bienvenida;
- huésped, habitación, llegada y salida;
- Wi‑Fi desde la Guía del huésped;
- horarios útiles;
- resumen de cuenta de esa reserva: total, pagado y saldo;
- información del hotel configurada en `hotel_guest_guides`;
- historial de pedidos creados desde ese portal.

## Acciones v1

- toallas -> Housekeeping;
- almohadas -> Housekeeping;
- limpieza -> Housekeeping;
- problema técnico -> Mantenimiento;
- late check-out -> Recepción, sólo como solicitud;
- otro pedido -> Recepción.

Todos los pedidos crean una `hotel_guest_request` asociada de forma determinística al `property_id`, `reservation_id` y `room_id` del token. El huésped nunca envía esos IDs.

### Late check-out

El portal no modifica fechas, tarifas ni disponibilidad. Sólo crea una solicitud en Recepción. El horario de salida cambia únicamente después de la decisión del personal en el PMS.

## Privacidad multitenant

`hotel_guest_stay_portals` y `hotel_guest_stay_portal_requests` tienen RLS y no conceden lectura/escritura directa a `anon` ni `authenticated`. Los RPC públicos son `SECURITY INVOKER`; la parte privilegiada vive en `guest_portal_private`, valida el token y resuelve servidor-side la propiedad, reserva y habitación.

El snapshot público devuelve únicamente datos de la reserva vinculada y los pedidos originados desde ese portal. No expone notas internas, datos de otras reservas, métodos de pago ni información administrativa.

## Decisión sobre IA

En v1 los botones del huésped se enrutan de forma determinística, sin IA, porque son acciones sencillas y predecibles. Esto reduce errores. A futuro puede agregarse un chat para texto libre: la IA clasifica la intención, pero sigue usando contratos tipados y nunca recibe permisos abiertos sobre el PMS.

## Prototipo visual

`/stay/demo` usa datos ficticios y permite probar la interfaz sin tocar operación real. Un token real abre exactamente la misma UI con datos del tenant y de la reserva correspondiente.

## Próximos pasos

- botón/QR en ficha de reserva para emitir y copiar el portal;
- notificación visual/sonora en Recepción para nuevas solicitudes de huésped;
- aceptar/rechazar late check-out desde la notificación con comprobación de disponibilidad;
- room service y catálogo de servicios;
- cargos opcionales y pagos desde el portal;
- acceso digital/llaves como módulo adicional cuando la propiedad lo tenga configurado.
