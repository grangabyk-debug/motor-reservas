# Habitación Llena PMS Next — sitemap operativo vivo

> Este archivo documenta la navegación y las conexiones funcionales actuales. El build valida que cada `view` declarada tenga workspace y entrada en este sitemap.

## Cómo se navega técnicamente

PMS Next usa una sola aplicación y selecciona el workspace mediante `?view=<id>`. La navegación siempre pasa por `activateView()`, que valida rol/permisos y redirige a Dashboard si la vista solicitada no está permitida.

## Navegación principal

### Núcleo diario

<!-- view:dashboard -->
- `dashboard` — **Dashboard**: resumen del turno, llegadas, salidas, ocupación, habitaciones y alertas.

<!-- view:portfolio -->
- `portfolio` — **Cartera**: vista central de todas las propiedades autorizadas, pensada para hoteles múltiples y operadores de unidades distribuidas en distintas direcciones. Resume ocupación, llegadas, salidas, limpieza/mantenimiento y permite entrar a la propiedad correcta sin mezclar inventarios.

<!-- view:planning -->
- `planning` — **Planning**: calendario operativo, creación/movimiento/extensión de reservas y disponibilidad.

<!-- view:reservations -->
- `reservations` — **Reservas**: listado y ficha completa; huéspedes, estadía, pagos, historial y operaciones vinculadas.

<!-- view:quotes -->
- `quotes` — **Presupuestos**: cotizaciones y conversión posterior a reserva.

<!-- view:guests -->
- `guests` — **Huéspedes**: perfil, historial, preferencias, idioma, etiquetas y datos de contacto.

<!-- view:messages -->
- `messages` — **Mensajes**: comunicaciones asociadas a huéspedes y reservas; núcleo del Inbox inteligente.

## Recepción y finanzas

<!-- view:dailycash -->
- `dailycash` — **Caja diaria**: cobros, efectivo, transferencias, tarjetas, movimientos, comprobantes, arqueo y Libro de novedades.

<!-- view:dailycontrol -->
- `dailycontrol` — **Control diario**: visitantes, vehículos y guarda equipajes vinculados a reservas, con entradas, salidas, entregas, búsqueda, exportación y trazabilidad operativa.

<!-- view:finance -->
- `finance` — **Finanzas**: saldos, documentos, solicitudes de pago y movimientos financieros.

<!-- view:receptionreports -->
- `receptionreports` — **Informes de recepción**: llegadas, salidas, desayunos y reportes operativos.

## Housekeeping

<!-- view:housekeeping -->
- `housekeeping` — **Housekeeping**: habitaciones, prioridades, limpieza, inspección, peticiones y cola de trabajo.

## Operación

<!-- view:maintenance -->
- `maintenance` — **Mantenimiento**: órdenes, preventivos, activos, proveedores, costos y habitaciones fuera de venta.

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

<!-- view:intelligence -->
- `intelligence` — **Inteligencia**: KPIs, pickup, pace, canales, finanzas, booking window y rendimiento por tipo de habitación.

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

<!-- view:help -->
- `help` — **Centro de ayuda**: guía categorizada, búsqueda y procedimientos operativos con acceso directo al área explicada.

<!-- view:support -->
- `support` — **Feedback y soporte**: asistente, escalamiento a soporte humano e ideas/mejoras con seguimiento.

## Integraciones

<!-- view:integrations -->
- `integrations` — **Apps externas**: conectores de terceros.

<!-- view:integrationapi -->
- `integrationapi` — **REST API**: acceso programático seguro; la capa pública de keys/scopes/webhooks continúa en desarrollo.

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

# Arquitectura de información objetivo

La navegación debe crecer por dominios y no por pantallas sueltas:

```text
Inicio
  Dashboard
  Cartera (multi-propiedad)

Operación
  Planning
  Reservas / Presupuestos
  Recepción / Caja
  Control diario
  Housekeeping
  Mantenimiento
  Inventario / Servicios

Huéspedes & CRM
  Huéspedes
  Mensajes
  [Segmentos / Campañas / Fidelización - próximos]

Comercial
  Tarifas y disponibilidad
  Revenue
  Sitio web / Motor
  [Promociones / Empresas / Agencias - próximos]

Distribución
  Channel Manager
  [Health Center - evolución]

Inteligencia
  Inteligencia
  Informes

Administración
  Equipo / Permisos
  Actividad
  Configuración
  Integraciones / API / Pagos

Ayuda
  Centro de ayuda
  Feedback y soporte
```

No se crea una nueva entrada lateral si la capacidad pertenece naturalmente a una página existente. Cuando un dominio crezca, debe agruparse en carpeta/subnavegación antes que sobrecargar el sidebar.

# Modelo multi-propiedad

```text
Cuenta / Workspace
  -> Propiedad A (hotel, edificio, cabañas, hostel...)
       -> habitaciones / unidades
  -> Propiedad B (departamento independiente)
       -> unidad
  -> Propiedad C (edificio)
       -> unidad 1
       -> unidad 2
       -> unidad 3
```

Principios:
- una dirección puede ser una propiedad independiente;
- un edificio puede ser una propiedad con varias unidades;
- la Cartera agrega lectura y priorización, pero no mezcla reservas/caja/inventario;
- el usuario entra a una propiedad antes de modificar datos operativos;
- roles y futuras reglas globales deberán soportar alcance por propiedad;
- la terminología podrá adaptarse a “Habitación” o “Unidad” según el tipo de operación.

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
       +-> Control diario -> Visitantes / Vehículos / Equipajes
       +-> Servicios y extras
       +-> Housekeeping / estado de habitación
       +-> Mantenimiento / incidencias
       +-> Actividad / auditoría

Habitación / Unidad
  <-> Planning
  <-> Housekeeping
  <-> Mantenimiento
  <-> Inventario operativo

Tarifas y disponibilidad
  <-> Planning
  <-> Sitio web / motor
  <-> Channel Manager
  <-> Revenue
  <-> Inteligencia

Cartera
  -> Propiedad -> todos los módulos operativos

Ayuda
  -> módulo explicado
  -> Feedback y soporte
```

---

# Roles actuales

## Owner / Manager / Admin
Acceso completo a las vistas permitidas por producto/feature flags, incluida Cartera.

## Recepción
Dashboard, Planning, Reservas, Presupuestos, Huéspedes, Mensajes, Caja diaria, Control diario, Finanzas, Informes de recepción, Inventario, Servicios, Tarifas, Actividad, Centro de ayuda y Soporte.

## Night Audit
Recepción + Control diario + Informes generales.

## Housekeeping
Dashboard, Housekeeping, Inventario, Centro de ayuda y Soporte.

## Mantenimiento
Dashboard, Mantenimiento, Inventario, Centro de ayuda y Soporte.

## Revenue
Dashboard, Cartera, Planning, Reservas, Presupuestos, Huéspedes, Servicios, Caja diaria, Tarifas, Finanzas, Sitio web, Ventas, Revenue, Inteligencia, Channel Manager, Informes, Centro de ayuda y Soporte.

## Member
Dashboard, Centro de ayuda y Soporte.

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
11. Entrada o procedimiento en el manual/centro de ayuda cuando sea una función visible al cliente.

Si uno de los primeros cinco puntos falta, `check:pms-sitemap` debe fallar antes del build.