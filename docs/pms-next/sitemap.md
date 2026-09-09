# Habitación Llena PMS Next — sitemap operativo vivo

> Este archivo documenta la navegación y las conexiones funcionales actuales. El build valida que cada `view` declarada tenga workspace y entrada en este sitemap.

## Cómo se navega técnicamente

PMS Next usa una sola aplicación y selecciona el workspace mediante `?view=<id>`. La navegación siempre pasa por `activateView()`, que valida rol/permisos y redirige a Dashboard si la vista solicitada no está permitida.

## Navegación principal

### Núcleo diario

<!-- view:dashboard -->
- `dashboard` — **Dashboard**: resumen del turno, llegadas, salidas, ocupación, habitaciones y alertas.

<!-- view:planning -->
- `planning` — **Planning**: calendario operativo, creación/movimiento/extensión de reservas y disponibilidad.

<!-- view:reservations -->
- `reservations` — **Reservas**: listado y ficha completa; huéspedes, estadía, pagos, historial y operaciones vinculadas.

<!-- view:quotes -->
- `quotes` — **Presupuestos**: cotizaciones y conversión posterior a reserva.

<!-- view:guests -->
- `guests` — **Huéspedes**: perfil, historial, preferencias, idioma, etiquetas y datos de contacto.

<!-- view:messages -->
- `messages` — **Mensajes**: comunicaciones asociadas a huéspedes y reservas; será el núcleo del Inbox inteligente.

## Recepción y finanzas

<!-- view:dailycash -->
- `dailycash` — **Caja diaria**: cobros, efectivo, transferencias, tarjetas, movimientos, comprobantes y arqueo.

<!-- view:finance -->
- `finance` — **Finanzas**: saldos, documentos, solicitudes de pago y movimientos financieros.

<!-- view:receptionreports -->
- `receptionreports` — **Informes de recepción**: llegadas, salidas, desayunos y reportes operativos.

## Housekeeping

<!-- view:housekeeping -->
- `housekeeping` — **Housekeeping**: habitaciones, prioridades, limpieza, inspección, peticiones y cola de trabajo.

## Operación

<!-- view:maintenance -->
- `maintenance` — **Mantenimiento**: incidencias, peticiones, prioridades, responsables y trazabilidad.

<!-- view:inventory -->
- `inventory` — **Inventario**: stock operativo, movimientos y reposición.

<!-- view:services -->
- `services` — **Servicios y extras**: catálogo y cargos asociados a reservas/huéspedes.

<!-- view:rates -->
- `rates` — **Tarifas y disponibilidad**: precio, disponibilidad y restricciones comerciales por fecha.

## Gestión y crecimiento

<!-- view:onboarding -->
- `onboarding` — **Puesta en marcha**: checklist de configuración inicial de la propiedad.

<!-- view:website -->
- `website` — **Sitio web**: estudio visual y motor conectado al inventario.

<!-- view:growth -->
- `growth` — **Ventas y crecimiento**: producción, origen de reservas y oportunidades comerciales.

<!-- view:revenue -->
- `revenue` — **Revenue**: forecast, pickup, ADR, RevPAR y recomendaciones.

<!-- view:channelmanager -->
- `channelmanager` — **Channel Manager**: distribución de tarifas, restricciones, disponibilidad y reservas.

<!-- view:reports -->
- `reports` — **Informes**: reportes operativos, comerciales y financieros.

<!-- view:audit -->
- `audit` — **Actividad**: auditoría de cambios y acciones.

<!-- view:staff -->
- `staff` — **Equipo**: usuarios, roles, permisos y procedimientos.

<!-- view:settings -->
- `settings` — **Configuración**: propiedad, preferencias, branding, reglas y features.

<!-- view:support -->
- `support` — **Ayuda & feedback**: asistente y escalamiento a soporte humano.

## Integraciones

<!-- view:integrations -->
- `integrations` — **Apps externas**: conectores de terceros.

<!-- view:integrationapi -->
- `integrationapi` — **REST API**: acceso programático seguro.

<!-- view:integrationmessages -->
- `integrationmessages` — **Mensajería**: conexiones de canales externos.

<!-- view:integrationpayments -->
- `integrationpayments` — **Pagos**: pasarelas y conexiones de cobro online.

## Vistas internas/contextuales

No tienen que convertirse automáticamente en nuevas opciones de menú. Existen para resolver trabajo dentro del flujo.

<!-- view:tasks -->
- `tasks` — **Tareas & check-lists**: vista interna de tareas operativas.

<!-- view:requests -->
- `requests` — **Solicitudes**: vista interna de peticiones; sólo se habilita con `guest_requests`.

<!-- view:subscription -->
- `subscription` — **Mi suscripción**: plan, habitaciones incluidas y módulos habilitados.

---

# Mapa de conexiones funcionales

```text
Huésped
  <-> Reserva <-> Planning
       |  |
       |  +-> Mensajes / Conversación
       |         |
       |         +-> Solicitud -> Housekeeping
       |         +-> Solicitud -> Mantenimiento
       |         +-> Solicitud -> Pago / Presupuesto
       |
       +-> Caja diaria <-> Finanzas
       +-> Servicios y extras
       +-> Housekeeping / estado de habitación
       +-> Mantenimiento / incidencias
       +-> Actividad / auditoría

Habitación
  <-> Planning
  <-> Housekeeping
  <-> Mantenimiento
  <-> Inventario operativo

Tarifas y disponibilidad
  <-> Planning
  <-> Sitio web / motor
  <-> Channel Manager
  <-> Revenue

Sitio web / motor
  -> Presupuesto o Reserva
  -> Pago
  -> Huésped

Integraciones
  -> API / webhooks
  -> Mensajería
  -> Pagos
  -> Canales
```

## Grafo prioritario de la próxima etapa

La primera integración profunda obligatoria es:

```text
Mensajes
  <-> Huésped
  <-> Reserva
  <-> Habitación
  <-> Saldo/Pagos
  <-> Housekeeping
  <-> Mantenimiento
```

El objetivo es que una consulta nunca necesite ser copiada manualmente por Recepción a otra área.

---

# Roles actuales

## Owner / Manager / Admin
Acceso completo a las vistas permitidas por producto/feature flags.

## Recepción
Dashboard, Planning, Reservas, Presupuestos, Huéspedes, Mensajes, Caja diaria, Finanzas, Informes de recepción, Inventario, Servicios, Tarifas, Actividad y Ayuda.

## Night Audit
Recepción + Informes generales.

## Housekeeping
Dashboard, Housekeeping, Inventario y Ayuda.

## Mantenimiento
Dashboard, Mantenimiento, Inventario y Ayuda.

## Revenue
Dashboard, Planning, Reservas, Presupuestos, Huéspedes, Servicios, Caja diaria, Tarifas, Finanzas, Sitio web, Ventas, Revenue, Channel Manager, Informes y Ayuda.

## Member
Dashboard y Ayuda.

---

# Contrato de navegación

Para agregar una nueva `view`, antes de darla por terminada deben existir todos estos puntos:

1. ID único en `core/navigation.js`.
2. Label y descripción.
3. Rol/permisos definidos.
4. Workspace real montado en `PmsNextApp.jsx`.
5. Entrada `<!-- view:<id> -->` en este sitemap.
6. Estados loading/empty/error.
7. CTA principal con acción real.
8. Responsive desktop/tablet/mobile.
9. Navegación de ida y vuelta a entidades relacionadas.
10. Auditoría para acciones sensibles.

Si uno de los primeros cinco puntos falta, `check:pms-sitemap` debe fallar antes del build.
