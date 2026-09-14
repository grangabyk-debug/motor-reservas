# Manual Habitación Llena — actualización v0.3

## Payments Automation — primer centro operativo

En **Finanzas -> Automatización** se concentra la lectura de solicitudes de cobro, garantías, depósitos y saldos que requieren intervención. El sistema puede crear links Mercado Pago para reservas en ARS con saldo, verificar su estado y conciliar el pago cuando el proveedor lo confirma.

La pantalla prioriza excepciones: cobros fallidos/vencidos, garantías por vencer, depósitos todavía retenidos y saldos pendientes en llegadas próximas. Los cargos automáticos sensibles, penalidades y devoluciones todavía no se ejecutan sin intervención humana.

## REST API v1 — primer corte productivo

En **Integraciones -> REST API** propietarios, gerencia y administración pueden crear credenciales reales por propiedad. El secreto se muestra una sola vez y Habitación Llena conserva únicamente su hash.

Cada clave define:

- nombre identificable;
- scope;
- vencimiento;
- rate limit por minuto;
- estado activa/revocada;
- último uso.

El primer scope real es `reservations:read` y habilita:

```http
GET /api/v1/reservations
Authorization: Bearer HL_API_KEY
```

Se puede filtrar por fecha de entrada, estado y límite. Las llamadas autenticadas quedan auditadas con HTTP status, ruta, duración y fecha. Una clave puede revocarse sin afectar otras integraciones.

### Importante

Los webhooks todavía no están disponibles. Serán el siguiente corte de la plataforma abierta y deberán incluir firma, reintentos e historial antes de mostrarse como función productiva.
