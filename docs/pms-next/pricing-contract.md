# PMS Next — Contrato de precios comerciales

## Regla de producto

Habitación Llena trabaja de cara al hotel con **precios finales**. Si la propiedad tiene IVA activo, el importe que escribe el operador ya incluye el IVA.

Ejemplo con IVA 21%:

- El propietario carga `$ 110.000`.
- El huésped paga `$ 110.000`.
- El PMS calcula internamente el neto y el IVA para folios, reportes y facturación.

El operador no debe calcular ni sumar IVA manualmente.

## Superficies alcanzadas

- Tarifas y disponibilidad.
- Extras y servicios.
- Precios comerciales usados al crear o cotizar una reserva.
- Venta directa / motor de reservas cuando consume esas tarifas.

## Almacenamiento

Las fuentes canónicas pueden conservar importes netos (`habitaciones.precio`, `hotel_rate_calendar.price`, `hotel_charge_catalog.amount`) para mantener un desglose fiscal consistente. La UI convierte siempre:

```text
precio final ingresado -> neto almacenado
neto almacenado -> precio final mostrado
```

Nunca se debe volver a sumar IVA sobre un importe que ya fue interpretado como precio final.

## Cambios porcentuales

Los botones de aumento/reducción de Tarifas y disponibilidad calculan el porcentaje sobre el **precio final con IVA incluido** y recién después convierten el resultado a neto para persistirlo. De esa manera el redondeo comercial coincide con lo que ve y vende el hotel.

## Histórico

Cambiar esta regla no reescribe reservas históricas ni altera automáticamente el total que ya estaba comunicado a un huésped. Las propiedades existentes se migran a `price_tax_mode = tax_included` conservando los netos almacenados; por eso el precio final vigente se mantiene hasta que el propietario decida modificarlo.
