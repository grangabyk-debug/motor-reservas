# Habitación Llena — Arquitectura PMS Enterprise

## Objetivo

Habitación Llena es un SaaS multi-tenant para hoteles. La arquitectura debe asumir muchos clientes, múltiples usuarios por propiedad, datos sensibles, operación 24/7 y actualizaciones frecuentes sin interrupciones evitables.

## Invariantes de multi-tenancy

1. Cada entidad operativa de hotel debe pertenecer a una `property_id` explícita o derivarse de una entidad que pertenezca inequívocamente a una propiedad.
2. El aislamiento se garantiza en Postgres mediante RLS y funciones de autorización; nunca depende solamente de filtros del frontend.
3. Un usuario sólo puede leer una propiedad si es owner o miembro autorizado de `property_members`.
4. Las escrituras requieren rol suficiente para el módulo. El frontend puede ocultar controles, pero la base vuelve a validar el permiso.
5. Ningún token administrativo/service-role se entrega al navegador.
6. Las RPC `SECURITY DEFINER` deben tener validación explícita de usuario/tenant o un diseño público por token documentado, limitado, expirable y auditable.
7. No se crean forks de código por hotel. Las diferencias comerciales/operativas se resuelven con configuración, planes y feature flags.
8. Nunca se usa un dato de otra propiedad como fallback cuando falta información en la propiedad activa.

## Modelo de acceso

- `properties`: hotel/propiedad tenant.
- `property_members`: relación usuario ↔ propiedad y rol.
- `profiles`: identidad operativa del usuario.
- `private.user_has_property_access(property_id)`: regla central de lectura.
- `private.user_has_property_role(property_id, roles[])`: regla central de escritura por rol.

Roles funcionales previstos: owner, admin, manager, reception, night_audit, housekeeping, maintenance, revenue y otros especializados cuando el módulo lo requiera.

## Regla de diseño de tablas

Una tabla hotelera nueva debe declarar antes de mergearse:

- quién es su tenant;
- columna `property_id` e índice correspondiente cuando aplique;
- RLS habilitado;
- políticas SELECT/INSERT/UPDATE/DELETE necesarias;
- FKs e índices de joins frecuentes;
- política de borrado/retención;
- auditoría si modifica reservas, dinero, accesos, facturación o inventario;
- pruebas que intenten acceso cruzado entre dos propiedades.

## Pruebas obligatorias de aislamiento

Cada módulo multi-tenant debe probar al menos dos propiedades A y B:

- usuario A puede leer A;
- usuario A no puede leer B;
- usuario A no puede insertar una fila con `property_id=B`;
- usuario A no puede actualizar/mover una fila de A hacia B;
- usuario A no puede invocar una RPC con un ID perteneciente a B;
- un rol de sólo lectura no puede ejecutar una acción de management;
- un usuario sin membresía obtiene cero filas o error de autorización, nunca datos parciales.

## Entornos

Antes de incorporar hoteles reales se debe operar con tres niveles separados:

1. **Development / Preview**: cambios en curso, datos sintéticos o anonimizados.
2. **Staging / QA**: réplica funcional del producto para probar builds, migraciones y flujos completos.
3. **Production**: clientes reales. No se realizan cambios manuales de esquema.

Las migraciones de base viven versionadas en Git y se prueban fuera de producción antes de aplicarse.

## Actualizaciones del SaaS

Los hoteles no instalan actualizaciones. Todos consumen la aplicación alojada. Una release se publica una vez y llega a todos los tenants compatibles.

Para reducir riesgo:

- funciones nuevas detrás de feature flags cuando corresponda;
- rollout: interno → hoteles piloto → porcentaje controlado → general;
- configuración por plan/propiedad sin bifurcar código;
- cambios de esquema backward-compatible;
- telemetría de errores después de cada release;
- rollback de aplicación disponible;
- migraciones destructivas separadas de la release que deja de usar los datos viejos.

## Estrategia de migraciones: expand / migrate / contract

Nunca combinar en una sola release un cambio destructivo con una aplicación que depende exclusivamente del esquema nuevo.

1. **Expand**: agregar tabla/columna/RPC nueva sin romper clientes actuales.
2. **Migrate**: desplegar aplicación compatible con viejo+nuevo y backfill si hace falta.
3. **Contract**: cuando ningún código dependa del esquema viejo, removerlo en una migración posterior.

Esto permite rollback de frontend sin volver incompatible la base.

## Feature flags

El producto debe soportar flags con alcance:

- global;
- plan;
- propiedad;
- usuario/rol sólo cuando exista un caso operativo real.

Cada flag tiene owner, descripción, fecha de creación y criterio de retiro. No se dejan flags permanentes sin motivo.

## Versionado

Cada release debe poder identificarse por:

- versión de producto (SemVer cuando estabilice el producto, por ejemplo `1.4.0`);
- Git commit SHA;
- fecha/hora de deploy;
- versión/migración mínima de base requerida.

El soporte debe poder saber rápidamente qué build estaba usando un hotel cuando ocurrió un incidente.

## Observabilidad

Registrar y poder correlacionar:

- errores de aplicación;
- request/deployment/version;
- `property_id` como identificador técnico no secreto cuando sea apropiado;
- usuario/rol sólo en logs seguros;
- latencia de RPC y consultas críticas;
- fallos de channel manager;
- fallos de facturación/ARCA;
- automatizaciones;
- operaciones de Planning;
- accesos y cambios de permisos.

No registrar contraseñas, tokens, datos completos de tarjetas ni secretos de proveedores.

## Datos y recuperación

Antes de producción comercial:

- backups verificados;
- Point-in-Time Recovery acorde al nivel de servicio contratado;
- procedimiento documentado de restore;
- simulacro periódico de recuperación;
- política de retención;
- exportación/portabilidad por cliente;
- baja de tenant controlada, nunca un DELETE manual improvisado.

## Seguridad de autenticación

- MFA para cuentas administrativas cuando corresponda;
- protección contra contraseñas filtradas;
- SMTP propio para correos de autenticación;
- sesiones y recuperación con tiempos razonables;
- rate limiting/CAPTCHA donde sea necesario;
- revisión periódica de miembros y owners.

## Estado de auditoría 2026-09-04

El Security Advisor detectó áreas que requieren hardening antes de producción masiva:

- `hotel_arca_credentials` y `hotel_arca_wsaa_cache` tienen RLS activo sin políticas; deben mantenerse explícitamente server-only o recibir políticas adecuadas según su contrato.
- existen RPC `SECURITY DEFINER` ejecutables por `anon` o `authenticated`; algunas parecen necesarias para web check-in/acceso por token, pero cada una debe auditar tenant, token, expiración y rol antes de modificar grants.
- leaked-password protection está deshabilitada.

El Performance Advisor detectó:

- FKs sin índices de cobertura en varios módulos;
- políticas RLS que reevalúan `auth.uid()` por fila y deben migrar al patrón `(select auth.uid())` cuando corresponda;
- políticas SELECT permisivas duplicadas en `profiles`;
- índices duplicados en `integration_connections` y `reservations`;
- Auth configurado con máximo absoluto de conexiones en vez de porcentaje.

Los índices marcados como “unused” no se eliminan automáticamente: primero se mide carga real y patrón de consultas.

## Gate de producción

No considerar una versión lista para hoteles reales hasta que cumpla:

- build y lint sin errores;
- pruebas multi-tenant cruzadas;
- flujos de reserva/check-in/check-out/pagos/Planning end-to-end;
- migración probada en staging;
- Security Advisor revisado;
- Performance Advisor revisado;
- backups/restore definidos;
- rollback probado;
- ninguna pantalla crítica con mocks/seed local;
- ninguna acción visible que simule persistencia;
- observabilidad activa;
- checklist de release aprobado.
