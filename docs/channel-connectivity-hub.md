# Llena Connect — arquitectura de conectividad

## Decisión

Habitación Llena no acopla el PMS a una OTA ni a un channel manager específico. El contrato estable es:

`PMS -> Llena Connect -> adaptadores -> canales`

Llena Connect es una capa interna y white-label. Para el hotel sigue existiendo un único Channel Manager dentro de Habitación Llena. Los nombres, credenciales y particularidades de infraestructura no forman parte de la operación diaria.

## Por qué hub

- Un solo modelo canónico para inventario, tarifas y restricciones.
- Un solo inbox de reservas entrantes con deduplicación.
- Un solo outbox con reintentos, backoff, trazabilidad y compactación de cambios.
- Permite reemplazar un mayorista o agregar un adapter directo sin reescribir Planning, Revenue o Reservas.
- Las reglas por canal son overrides; no contaminan la tarifa base del hotel.
- Las credenciales se guardan en Vault y solo son leídas por funciones de servicio.

## Primer adapter

El primer adapter previsto es Channex por debajo de Llena Connect. Se usa como infraestructura de conectividad, no como producto visible para el hotel. La implementación queda preparada para staging, mapeo de property/room type/rate plan y ARI. No se considera una conexión real hasta contar con cuenta, credenciales, mapeos y pruebas/certificación del proveedor.

Más adelante pueden coexistir adapters directos (por ejemplo, cuando una OTA habilite partnership directo y la economía lo justifique) sin cambiar el contrato de Llena Connect.

## Modelo canónico

### Salida (ARI)

`hotel_distribution_calendar` define por propiedad, tipología y fecha:

- precio base;
- disponibilidad calculada desde inventario físico;
- estadía mínima/máxima;
- Stop Sell;
- CTA / CTD.

`hotel_channel_rate_overrides` permite variar precio o restricciones para un canal concreto sin modificar la venta directa.

`hl_channel_inventory_snapshot` calcula disponibilidad real restando reservas activas, bloqueos físicos y cupos de grupos, y omite tentativas vencidas.

### Mapeo

`hotel_channel_mappings` desacopla las claves locales de los IDs del adapter externo. Los mapeos mínimos para publicar son:

- tipología local -> room type externo;
- tarifa estándar local -> rate plan externo.

### Outbox

Reservas, bloqueos y cambios tarifarios generan eventos. `hl_channel_queue_change` compacta ventanas pendientes por conexión y tipo de evento para evitar llamadas redundantes. El worker registra intentos, respuesta, error y reintento exponencial.

### Inbox

`hotel_channel_inbox` es la frontera para reservas, modificaciones y cancelaciones externas. Cada evento tiene un `provider_event_id` único por conexión para que los reintentos no creen reservas duplicadas.

El procesamiento automático de reservas entrantes debe habilitarse únicamente después de validar un feed real en staging. Nunca se confirma/ACK un mensaje externo antes de guardar correctamente la reserva en el PMS.

## Anti-overbooking

La fuente de verdad del inventario es Habitación Llena. Después de cada alta, cambio o cancelación de reserva, el outbox recalcula y publica la ventana afectada. La sincronización completa es un mecanismo de reconciliación, no el camino normal de cada cambio.

## Seguridad

- RLS por propiedad en tablas operativas visibles.
- Outbox, inbox y sync runs son de lectura para usuarios autenticados; las escrituras operativas son de servicio.
- API keys externas se guardan en Supabase Vault mediante helpers ejecutables solo por `service_role`.
- Nunca se guarda una API key en `hotel_channel_connections`, frontend o logs.
- La UI no debe afirmar “conectado” hasta que el adapter haya respondido y exista un sync real.

## Estado actual

La base canónica, mapeos, overrides, outbox/inbox, snapshot de inventario y worker de salida están implementados. Falta onboarding real del adapter (cuenta, API key, property ID, mapeos y pruebas de staging) antes de activar publicación externa.

La importación automática de reservas entrantes queda deliberadamente pendiente hasta validar payloads reales de altas, modificaciones y cancelaciones.
