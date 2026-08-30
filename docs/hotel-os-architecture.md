# Habitación Llena OS — arquitectura de producto

## Objetivo
Construir un Hospitality Operating System multitenant que se sienta simple para el hotel aunque internamente sea profundo. La complejidad vive en módulos pequeños, contratos claros y operaciones atómicas; nunca en una única página gigante.

## Principios
1. **Pocas categorías visibles, muchas capacidades contextuales.** El shell expone Recepción, Operación, Comercial, Administración y Hotel.
2. **Un solo dato.** Reserva, huésped, empresa/agencia, grupo, folio, housekeeping, recursos, upsells y Web Check-in se relacionan por IDs estables.
3. **Tenant primero.** Toda consulta de negocio necesita `property_id`; RLS es la segunda barrera, no la primera.
4. **Inventario atómico.** Crear/mover/extender/split/check-out/bloqueos y reglas tarifarias que puedan generar overbooking se resuelven en RPC/transacciones PostgreSQL.
5. **UI por features.** Cada área contiene sus componentes, hooks, servicios y pruebas. El shell no conoce SQL ni reglas de negocio.
6. **Servidor para secretos.** Service role, proveedores de email, pagos, channel managers y credenciales de hardware nunca llegan al browser.
7. **Build verifica; no reescribe producto.** Los scripts de build deben validar invariantes y límites, no parchear el PMS.
8. **Sin big-bang refactor.** Se migra feature por feature conservando comportamiento y datos de producción.

## Estructura destino
```text
app/dashboard/
  core/                 # navegación, roles, formatos, contratos
  data/                 # repositorios tenant-scoped
  hooks/                # sesión, realtime, queries
  components/shell/     # sidebar, topbar, command palette
  features/
    frontdesk/           # lobby, command center, reserva, llaves
    guests/              # CRM, preferencias, fidelización
    operations/          # habitaciones, housekeeping, mantenimiento, recursos
    commercial/          # tarifas, forecast, distribución, upselling, grupos/agencias
    finance/             # caja, folios, facturación, pagos, reportes
    hotel/               # equipo, permisos, automatizaciones, settings, integrations
  services/              # email, web-checkin, encoders, canales
```

## Navegación de producto
- **Recepción:** Inicio, Command Center, Reservas, Huéspedes, Llaves.
- **Operación:** Habitaciones, Housekeeping, Mantenimiento, Recursos.
- **Comercial:** Revenue, Empresas & Agencias, Grupos, Upselling, Distribución.
- **Administración:** Caja & Folios, Facturación, Reportes.
- **Hotel:** Equipo & Roles, Automatizaciones, Integraciones, Configuración.

El usuario ve inicialmente solo las cinco categorías. Cada categoría recuerda su última herramienta y los accesos también aparecen en contexto (por ejemplo, una incidencia de mantenimiento desde una habitación).

## Multitenancy y seguridad
- Ningún repositorio acepta una consulta de negocio sin `propertyId` válido.
- Todas las tablas hoteleras mantienen `property_id` + RLS.
- Los endpoints públicos (motor, Web Check-in) usan tokens opacos, hash en base, expiración y RPCs limitadas.
- No almacenar PAN/CVV de tarjetas. Garantía: marca, últimos 4, vencimiento/referencia o token del PSP.
- Rate limiting y protección anti-bot se aplican en los endpoints públicos antes de abrir captación masiva.
- Auditoría para acciones sensibles: permisos, llaves, caja, facturas, movimientos de reserva e integraciones.

## Rendimiento
- Cargar snapshots por área, no todas las tablas para todas las pantallas.
- Realtime solo en eventos que cambian el turno actual.
- Paginación/virtualización en huéspedes, reservas históricas, auditoría y reportes.
- Índices por `property_id` + claves de uso real.
- Imágenes y texturas decorativas nunca deben bloquear la interacción.

## Estrategia de migración
1. Extraer `core`, permisos y repositorio tenant-scoped.
2. Reemplazar shell/navegación sin cambiar features.
3. Extraer Reserva/Command Center y eliminar el parche de build.
4. Migrar Operación, Comercial, Administración y Hotel.
5. Activar nuevos módulos (CRM, grupos, Web Check-in, recursos, mantenimiento, caja, upsell) detrás de contratos nuevos.
6. QA funcional + seguridad + responsive; un solo release a `main`.
