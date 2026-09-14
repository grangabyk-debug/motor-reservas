# PMS Next — seguridad multi-tenant y permisos empresariales

Estado: diseño preparado para validar primero en Supabase staging. No aplicar en producción sin QA de roles.

## Principio

La interfaz no es una barrera de seguridad. La base de datos debe ser la autoridad final para decidir qué propiedad puede tocar un usuario y qué acciones puede ejecutar dentro de esa propiedad.

## Lo que ya existe y se conserva

- RLS activo en reservas, habitaciones, pagos, caja y gastos.
- `private.user_has_property_access(property_id)` separa propiedades por owner/membership.
- `private.user_has_property_role(property_id, roles[])` restringe operaciones por rol.
- `hotel_role_permissions(property_id, role, permission, allowed)` ya existe como fuente de overrides por rol.
- Las reservas tienen un trigger de integridad que usa `pg_advisory_xact_lock` por propiedad + habitación y vuelve a comprobar reservas/bloqueos dentro de la transacción. Esto evita carreras de sobreventa aun si dos recepcionistas actúan al mismo tiempo.
- Las operaciones ARCA guardan secretos mediante funciones reservadas a `service_role`; no deben exponerse al navegador.

## Brecha encontrada

PMS Next guarda actualmente la visibilidad de módulos en `property_settings.settings.role_permissions`, mientras las autorizaciones de base usan roles fijos y `hotel_role_permissions` en algunos subsistemas.

Eso crea dos fuentes de verdad. Ejemplo: Finanzas puede desaparecer del menú de Recepción pero la política SELECT actual de pagos/caja/gastos permite leer datos a cualquier miembro de la propiedad.

## Objetivo

Usar `hotel_role_permissions` como fuente de verdad para permisos configurables. `property_settings` puede conservar preferencias visuales/feature flags, pero no debe decidir autorización sensible.

Permisos de módulos propuestos:

- `module.dashboard.view`
- `module.planning.view`
- `module.reservations.view`
- `module.quotes.view`
- `module.guests.view`
- `module.messages.view`
- `module.tasks.view`
- `module.maintenance.view`
- `module.housekeeping.view`
- `module.inventory.view`
- `module.rates.view`
- `module.finance.view`
- `module.reports.view`
- `module.audit.view`
- `module.staff.view`
- `module.integrations.view`
- `module.settings.view`

Permisos sensibles separados de la mera visibilidad:

- `finance.manage`
- `cash.operate`
- `reports.export`
- `rates.manage`
- `staff.manage`
- `settings.manage_roles`
- `integrations.manage`
- `reservations.delete`

## Rollout seguro

1. Crear branch de Supabase staging.
2. Instalar helper general de permisos con fallback conservador por rol.
3. Cambiar sólo RLS de tablas financieras en staging.
4. Probar usuarios Owner, Manager, Reception y Housekeeping en dos propiedades distintas.
5. Conectar la matriz de Configuración a `hotel_role_permissions`.
6. Comprobar que ocultar Finanzas bloquea también SELECT directo desde Supabase/PostgREST.
7. Ejecutar Security Advisor y Performance Advisor.
8. Recién después preparar migración de producción.

## Matriz QA mínima

| Caso | Resultado esperado |
|---|---|
| Recepción A consulta reservas de Hotel A | Permitido |
| Recepción A consulta reservas de Hotel B | Denegado/vacío por RLS |
| Recepción sin `module.finance.view` consulta pagos/caja/gastos | Denegado/vacío |
| Recepción con `cash.operate` abre/cierra caja | Permitido |
| Housekeeping intenta crear reserva | Denegado |
| Manager exporta informes | Permitido si `reports.export` |
| Usuario mueve dos reservas a la misma habitación simultáneamente | Una operación debe fallar por conflicto |
| Cliente intenta leer secretos ARCA desde navegador | Denegado |

## ARCA

Ya existen `hotel_arca_credentials`, `hotel_arca_wsaa_cache` y helpers de Vault restringidos a `service_role`. El onboarding y WSAA/WSFE deben implementarse en rutas de servidor, nunca con la clave privada/certificado expuestos al cliente.

## Channel Manager

El PMS ya presenta un Hub propio y guarda conexiones/mapeos/logs bajo la propiedad. Los secretos del proveedor deben permanecer server-side; la UI debe mostrar sólo canales OTA y estado de sincronización.
