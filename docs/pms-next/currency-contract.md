# PMS Next — Contrato de monedas y cotización

## Objetivo
Habitación Llena permite que cada propiedad trabaje sus tarifas maestras en ARS o USD sin confundir moneda de tarifa, equivalencia visual y moneda de cobro.

## Moneda base de tarifas
- `settings.pricing.rate_currency`: `ARS` o `USD`.
- Es la moneda maestra de `habitaciones.precio` y `hotel_rate_calendar.price`.
- Cambiarla no cambia sólo el símbolo: `hl_change_rate_currency` convierte atómicamente ambas fuentes con la cotización visible al propietario.
- Las reservas históricas no se reescriben.
- Las reservas directas nuevas adoptan la moneda base vigente.

## Cotización USD / ARS
- `automatic`: consulta la API pública de Estadísticas Cambiarias del BCRA mediante `/api/hotel/exchange-rate`.
- `manual`: el propietario fija el valor `1 USD = X ARS`.
- La UI siempre muestra fuente y fecha cuando están disponibles.
- La cotización modifica equivalencias, no la tarifa maestra USD.

## Precios e IVA
La moneda es independiente del contrato fiscal. El propietario carga siempre precio final con IVA incluido. El PMS conserva neto/IVA con precisión interna y muestra el final en la moneda base.

## Conversión visual
Si la base es USD, una tarifa puede verse como `USD 80,00` y debajo `≈ ARS ...`. Si la base es ARS se muestra el equivalente aproximado en USD. La equivalencia no reemplaza el valor maestro.

## Reservas y auditoría
- Una reserva ya creada conserva `moneda` y valores originales.
- No se recalculan reservas existentes cuando cambia la cotización o la moneda base de tarifas.
- Un cambio de moneda base registra cotización, fuente, fecha, moneda anterior/nueva y momento de conversión en `settings.pricing`.

## Cobros en moneda distinta
El flujo de liquidación ARS↔USD debe registrar moneda entregada, importe entregado y snapshot de cotización, y normalizar el pago a la moneda de la reserva antes de afectar saldo. Nunca se resta un monto ARS directamente de un saldo USD ni viceversa.
