# Payments Automation - contrato funcional

## Objetivo

Concentrar el ciclo financiero de una reserva sin duplicar Caja ni Finanzas. El sistema debe distinguir entre **saldo**, **solicitud de cobro**, **garantía**, **depósito**, **pago confirmado**, **devolución** y **conciliación**.

## Primer corte operativo

Disponible dentro de Finanzas -> Automatización:

- lectura real de `hotel_payment_requests`;
- lectura real de `hotel_guarantees`;
- lectura real de `hotel_deposits`;
- cálculo de saldo con `reservas` + `pagos`;
- creación de links de cobro Mercado Pago para reservas ARS;
- verificación manual de una solicitud contra Mercado Pago;
- conciliación mediante el RPC existente `hl_settle_payment_request` cuando el proveedor confirma el pago;
- detección de cobros fallidos/vencidos;
- detección de garantías retenidas próximas a vencer;
- detección de depósitos todavía retenidos en reservas cerradas/canceladas;
- detección de saldos pendientes en llegadas de los próximos 7 días.

## Principio de seguridad

El primer corte **no ejecuta débitos automáticos silenciosos**. Dinero, penalidades, captura de garantías y devoluciones siguen requiriendo una acción explícita o una regla futura con límites, consentimiento, permisos y auditoría.

## Flujo canónico

```text
Política / regla
   -> solicitud de cobro | garantía | depósito
   -> proveedor de pago
   -> resultado
   -> conciliación en reserva/folio
   -> alerta si requiere intervención
```

## Próximos cortes

1. reglas por tarifa/canal para depósito o garantía;
2. cobros programados por fecha relativa a llegada/salida;
3. reintentos con ventanas y máximo de intentos;
4. penalidad por cancelación/No Show con confirmación y política aplicable;
5. devolución parcial/total guiada;
6. conciliación automática por webhook/evento;
7. alertas y timeline financiero unificado;
8. PSP desacoplado para permitir otros proveedores además de Mercado Pago.

## Reglas de producto

- Nunca sumar importes de monedas distintas como si fueran equivalentes.
- Una solicitud nunca puede superar el saldo pendiente de la reserva.
- Una reserva sin saldo no genera un link de cobro.
- Los links de Mercado Pago de este flujo se emiten en ARS mientras el conector mantenga esa restricción.
- Toda operación debe conservar `property_id` y relación estable a `reserva_id`.
- El centro de automatización no reemplaza Caja diaria: Caja registra la operación del turno; Automatización administra el ciclo de cobro de la reserva.
