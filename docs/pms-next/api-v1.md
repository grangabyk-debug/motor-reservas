# Habitación Llena API v1 — primer contrato productivo

## Estado

Primer corte operativo. La gestión vive en **Integraciones -> REST API** y usa claves por propiedad. No se publican credenciales ficticias ni se guarda el secreto completo.

## Seguridad de claves

- formato generado por Habitación Llena: `hl_<prefijo>_<secreto>`;
- el secreto completo se muestra una sola vez al crearlo;
- la base conserva solamente SHA-256 + prefijo visible;
- cada clave pertenece a una sola `property_id`;
- una clave puede revocarse sin afectar otras integraciones;
- puede tener vencimiento y rate limit independiente;
- el primer scope real es `reservations:read`.

## Endpoint disponible

### `GET /api/v1/reservations`

Scope: `reservations:read`.

Header:

```http
Authorization: Bearer HL_API_KEY
```

Filtros:

- `from=YYYY-MM-DD`: fecha de entrada desde;
- `to=YYYY-MM-DD`: fecha de entrada hasta;
- `status=<estado>`;
- `limit=1..100`, default 50;
- `after_id=<id>` para continuar la paginación simple.

Ejemplo:

```bash
curl "https://habitacionllena.com/api/v1/reservations?from=2026-09-13&limit=50" \
  -H "Authorization: Bearer HL_API_KEY"
```

Respuesta:

```json
{
  "data": [],
  "meta": {
    "count": 0,
    "limit": 50,
    "next_after_id": null,
    "filters": {
      "from": "2026-09-13",
      "to": null,
      "status": null
    }
  }
}
```

## Rate limit

Cada clave define solicitudes por minuto entre 1 y 600. El endpoint devuelve:

- `X-RateLimit-Limit`;
- `X-RateLimit-Remaining`;
- `Retry-After: 60` al responder HTTP 429.

El primer corte usa el log de solicitudes como contador por ventana de 60 segundos. Es suficiente para el volumen inicial; si la plataforma escala, se reemplazará por un contador atómico dedicado sin cambiar el contrato público.

## Auditoría

Cada llamada autenticada registra:

- propiedad;
- clave utilizada;
- método;
- ruta;
- HTTP status;
- duración;
- IP de origen cuando está disponible;
- timestamp.

La pantalla de REST API muestra las últimas llamadas y el uso de las últimas 24 horas.

## Webhooks

**No disponibles todavía.** El siguiente corte agregará webhooks versionados para reservas, pagos, check-in/out y habitaciones, con firma, reintentos, estado e historial. La interfaz no simula endpoints ni secretos de webhook antes de que exista el backend real.

## Próximos scopes

Se agregan únicamente cuando exista un endpoint real y documentado. Candidatos futuros:

- `guests:read`;
- `availability:read`;
- `rates:read` / `rates:write`;
- `payments:read`;
- `webhooks:manage`.

## Regla de compatibilidad

La versión `v1` no cambia contratos existentes de forma incompatible. Un cambio destructivo requiere versión nueva o una transición documentada.
