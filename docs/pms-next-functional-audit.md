# Habitación Llena — auditoría funcional PMS

Estado vivo del rebuild `pms-rebuild-zero`. Este documento se usa como checklist de producto, QA y futura base del sitemap.

Leyenda:
- ✅ IMPLEMENTADO: flujo funcional conectado a datos reales.
- 🧱 BACKEND PREPARADO: migración/capa preparada, pendiente de aplicar y probar en Supabase staging.
- 🔎 FALTA RELEVAR: ruta/flujo de referencia todavía no completamente inspeccionado.
- 🧩 OPCIONAL: útil sólo para hoteles que lo necesiten; debe ir detrás de feature flag.

## Núcleo PMS

- ✅ Dashboard operativo real.
- ✅ Planning por habitaciones/fechas con creación y movimiento mediante RPC atómica.
- ✅ Reservas: búsqueda, detalle, no-show, cancelación/restauración, check-in/check-out, pagos/saldo.
- ✅ Huéspedes CRM: perfiles, estadías y gasto.
- ✅ Inbox: lectura/búsqueda/archivo reales; envío saliente pendiente de adaptador seguro.
- ✅ Navegación SPA sin recargar módulos.
- ✅ Cambio de propiedad y rol real por propiedad.
- ✅ Intro de acceso + login/registro/recuperación unificados.
- ✅ Detector de versión nueva sin refresh forzado.
- ✅ Feature flags por propiedad.
- ✅ Actividad/auditoría de Planning, reservas, caja y automatizaciones.

## Operaciones

Referencia Heroes relevada:
- Tasks `/tasks`
- Check-lists `/tasks/scheduled`
- Manage check-lists `/tasks/scheduled/manage`
- Requests `/requests`
- Inventory `/tools/inventory`
- Deep clean `/tools/deep-clean`
- Air conditioning `/gestion/air-conditioning`
- Technicians `/gestion/ac-technicians`
- Walkie history `/tools/walkie-history`
- Staff devices retrospective `/tools/device-history`

Estado Habitación Llena:
- ✅ Mantenimiento correctivo: Kanban, tabla, archivo, prioridades, responsable y vencimiento.
- ✅ Checklist catálogo de housekeeping.
- ✅ Housekeeping diario + limpieza profunda.
- ✅ Inventario por habitación desde controles reales.
- 🧱 Solicitudes de huésped (`hotel_guest_requests`).
- 🧱 Rutinas recurrentes por hotel/empleado, weekly/monthly/annual (`hotel_operational_routines`).
- 🧱 Mantenimiento preventivo genérico con historial (`hotel_preventive_maintenance_*`).
- 🧱 Proveedores/técnicos externos (`hotel_suppliers`).
- 🧩 Walkie-talkie interno.
- 🧩 Historial de dispositivos del personal.

Detalles de Heroes que deben quedar cubiertos al habilitar rutinas:
- título + descripción;
- ocurrencias múltiples;
- ejecución por hotel o por empleado;
- selección de empleados;
- semanal/mensual/anual;
- días de semana/fecha;
- progreso diario y administración de plantillas.

Detalles de mantenimiento preventivo relevados en Air Conditioning:
- plan por habitación/recurso;
- última intervención;
- próxima fecha;
- estados nunca realizado / al día / próximo / vencido;
- historial por tipo de tarea;
- filtros Todos / Pendientes / Hechos;
- técnico/proveedor asociado.

## Propiedad

Referencia Heroes completamente relevada:
- Rooms `/gestion/rooms`
- Room Types `/gestion/room-types`
- Items `/gestion/items`
- Suppliers `/gestion/suppliers`
- NFC presence `/gestion/nfc-presence`
- Smart devices `/gestion/iot`
- Utility meters `/tools/metering`
- Property settings `/settings/property`
- Telephony `/settings/telephony`
- Setup `/tools/setup`
- Restaging `/tools/restaging`
- AI photo studio `/tools/ai-studio`

Estado Habitación Llena:
- ✅ Propiedad, habitaciones, pisos, tipos y preferencias.
- ✅ Servicios/extras mediante `hotel_charge_catalog`.
- 🧱 Proveedores.
- ✅ Puesta a punto basada en configuración real.
- 🧩 NFC/presencia.
- 🧩 IoT/dispositivos inteligentes.
- 🧩 Medidores de servicios.
- 🧩 Telefonía.
- 🧩 Restaging/AI studio (fuera del núcleo PMS).

## Finanzas y revenue

Referencia Heroes relevada:
- Financial dashboard `/finances/dashboard`
- Payments `/reservations/payments`
- Invoices `/reservations/invoices`
- Cash Drop `/tools/cash-drop`
- Recurring expenses `/tools/recurring-expenses`
- Rates & Availability `/calendar/availability`

Estado Habitación Llena:
- ✅ Dashboard financiero modular.
- ✅ Pagos con filtros, paginación y CSV.
- ✅ Documentos/facturas.
- ✅ Caja y movimientos.
- ✅ Gastos registrados.
- ✅ Tarifas y disponibilidad por calendario.
- 🧱 Gastos recurrentes necesitan entidad/worker dedicado.
- ✅ Informes: ocupación, ADR, RevPAR, ingresos, cobros, canales, entradas/salidas y CSV.

Detalles adicionales relevados en dashboard financiero Heroes:
- períodos Hoy / 7 días / 30 días / mes;
- ocultar/mostrar importes;
- reservas por origen con selector Reservas/Noches/Revenue;
- reservas recientes;
- centro de novedades y sugerencias de producto.

## Equipo, permisos y seguridad

- ✅ Membresías y rol real por propiedad.
- ✅ Navegación condicionada por rol; RLS sigue siendo autoridad final.
- ✅ RLS activo en tablas tenant con `property_id`.
- ✅ Test global actual `tenant_relational_integrity_ok`.
- 🧱 Corrección de dos policies antiguas con correlación tautológica preparada.
- 🧱 Optimización RLS/indexes preparada para staging.
- 🧱 Hardening de tokens públicos web-checkin/acceso preparado.
- 🧱 Invitaciones de equipo por email todavía requieren backend específico.
- 🔎 Staff de Heroes: subrutas reales todavía por descubrir; `/staff` y `/gestion/staff` no existen.

## Integraciones

- ✅ Hub basado en channel manager real: conexiones, mapeos y sincronizaciones.
- ✅ No se exponen credenciales en cliente.
- 🔎 Subrutas exactas de Heroes todavía por relevar.

## F&B

- 🔎 Menú y subrutas de Heroes todavía por descubrir; `/food-beverage` no existe.
- ✅ Servicios y extras ya cubren desayuno, minibar, lavandería, cochera, late checkout, mascotas y cargos simples.
- Pendiente decidir si Habitación Llena necesita POS/F&B completo dentro del PMS o integración desacoplada.

## Growth

- 🔎 Subrutas reales de Heroes todavía por descubrir; `/growth` no existe.
- Pendiente contrastar: upsells, motor directo, reputación/marketing y herramientas comerciales.

## Producto SaaS / soporte

- ✅ Release SHA visible para soporte.
- ✅ Actualización disponible sin recarga forzada.
- ✅ CI en cada push del rebuild: aislamiento, rechazo de fixtures/demo y build.
- ✅ PR #76 permanece draft.
- ✅ Producción/main no se toca durante el rebuild.
- 🧱 Supabase staging pendiente de autorización/costo.
- Pendiente: centro de novedades/release notes visible para clientes.
- Pendiente: canal de sugerencias/feedback comercial.

## Gate para declarar el PMS 100%

No declarar listo para clientes hasta cumplir todo:
1. Supabase staging operativo.
2. Todas las migraciones nuevas aplicadas y testeadas en staging.
3. Tests Hotel A vs Hotel B de lectura y escritura.
4. QA completo de Planning, reserva, check-in/out, pagos, caja, factura, housekeeping y tarifas.
5. Flujos de error y concurrencia probados.
6. Sin botones muertos ni placeholders visibles.
7. Todos los módulos habilitados tienen backend real.
8. Permisos revisados por rol.
9. Rollback probado.
10. Sitemap funcional y diagrama técnico actualizados.
