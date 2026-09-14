# Habitación Llena — manual funcional v0.1

> Documento vivo para capacitación, soporte y control interno. Fecha: 13/09/2026. La versión PDF se genera a partir de esta línea documental y debe mantenerse sincronizada con producto y sitemap.

## Estados

- **DISPONIBLE**: utilizable hoy.
- **EN DESARROLLO**: existe una base real, pero faltan piezas antes de considerarla cerrada.
- **PLANIFICADO**: dirección aprobada; no debe venderse como disponible.

## Conceptos básicos

Habitación Llena trabaja siempre sobre una **propiedad activa**. Una cuenta puede acceder a varias propiedades sin mezclar sus reservas, caja, inventario ni canales. La navegación lateral cambia de área y los vínculos contextuales conectan reserva, huésped, habitación/unidad, pagos, mensajes, housekeeping y mantenimiento.

### Dashboard — DISPONIBLE
Resumen en vivo de ocupación, llegadas, salidas, huéspedes, habitaciones listas, cobros y alertas. Es el punto recomendado para comenzar el turno.

### Cartera multi-propiedad — EN DESARROLLO
Vista central para operadores con varios hoteles, edificios, departamentos, casas o cabañas. Resume indicadores por propiedad y permite abrir el Dashboard o Planning correcto. Modelo: **Cuenta/Workspace → Propiedades → Habitaciones/Unidades**.

### Planning — DISPONIBLE
Calendario central de disponibilidad y reservas. Permite crear reservas individuales/grupales, mover y extender, gestionar tramos, ver estados/pagos y bloquear inventario por mantenimiento, uso interno, fuera de servicio, cortesía, grupo u otros motivos.

### Reservas — DISPONIBLE
Ficha completa con titular, acompañantes, fechas, canal, habitaciones, saldo, pagos, documentos, notas e historial. Incluye reservas grupales, salida por habitación, cancelación parcial, extensiones, No Show, folios/pagadores y redistribución de cargos.

### Presupuestos — DISPONIBLE
Cotizaciones previas a la reserva con fechas, habitaciones/tipos, tarifas y condiciones, convertibles a reserva.

### Huéspedes — DISPONIBLE
Perfil operativo con historial, contacto, documento, idioma, etiquetas, VIP, preferencias, notas, cumpleaños y recurrencia.

### CRM y fidelización — EN DESARROLLO
Segmentación, campañas y automatizaciones pre/durante/post estadía, cumpleaños, reactivación, métricas y fidelización.

### Mensajes — DISPONIBLE
Conversaciones vinculadas a huésped/reserva y navegación contextual a entidades operativas. Base del inbox inteligente.

### Caja diaria — DISPONIBLE
Apertura por responsable/turno, cobros, movimientos, arqueo, cierres e historial. El **Libro de novedades** puede editarse durante el turno y su versión vigente se adjunta al cierre, PDF y email.

### Finanzas — DISPONIBLE
Saldos, pagos, documentos, solicitudes y folios. Soporta varios pagadores y división/redistribución de cargos.

### Payments Automation — EN DESARROLLO
Depósitos, cobros programados, garantías, penalidades, reintentos, devoluciones y conciliación automática.

### Housekeeping — DISPONIBLE
Cola de limpieza e inspección por habitación/unidad, prioridades, peticiones y próximas llegadas. Diseñada para uso móvil.

### Mantenimiento — DISPONIBLE
Órdenes de trabajo, preventivos, activos, proveedores, prioridades y habitaciones fuera de venta.

### Solicitudes y tareas — DISPONIBLE
Peticiones del huésped y trabajo operativo interno enrutados al área correspondiente.

### Inventario — DISPONIBLE
Stock operativo, movimientos y reposición.

### Servicios y extras — DISPONIBLE
Catálogo de adicionales cargables a reserva/folio; base para upselling.

### Tarifas y disponibilidad — DISPONIBLE
Precios por fecha, planes base/derivados, variaciones, apertura/cierre, estadía mínima/máxima, restricciones, temporadas/yield y propagación a motor/canales.

### Sitio web y motor — DISPONIBLE
Construcción visual del sitio y motor de reserva directa conectado al inventario.

### Promociones, paquetes y upselling — PLANIFICADO
Códigos promocionales, paquetes, extras pre-arrival, recuperación de abandono y conexión comercial con Google Hotel Ads/Free Booking Links.

### Revenue — DISPONIBLE
Forecast, pickup, ADR, RevPAR y recomendaciones basadas en datos reales.

### Revenue autopilot — PLANIFICADO
Señales de mercado, recomendación accionable y automatización con límites, aprobación y auditoría.

### Inteligencia e informes — DISPONIBLE
KPIs, canales, finanzas, booking window, rendimiento por tipo de habitación y reportes operativos/comerciales/financieros.

### Informes programados — PLANIFICADO
Constructor, filtros guardados y envíos automáticos.

### Channel Manager — DISPONIBLE
Sincronización de disponibilidad, tarifas, restricciones y reservas mediante la infraestructura configurada. Los mapeos y monedas deben revisarse antes de activar canales.

### Health Center — EN DESARROLLO
Diagnóstico de sincronización, mapping, colas/reintentos, reservas rechazadas e inconsistencias PMS-OTA.

### Equipo — DISPONIBLE
Usuarios y roles por propiedad.

### Permisos granulares — EN DESARROLLO
Matriz por acción y alcance: tarifas, descuentos, pagos, cierres, informes, canales y funciones sensibles.

### Actividad — DISPONIBLE
Auditoría de acciones y cambios.

### Configuración — DISPONIBLE
Preferencias de propiedad, branding, reglas y features.

### Puesta en marcha — DISPONIBLE
Checklist de implementación.

### Apps externas — DISPONIBLE
Área de conectores.

### REST API — EN DESARROLLO
La experiencia pública necesita completar keys, scopes, webhooks, rate limits, logs, revocación, sandbox y documentación.

### Centro de ayuda — EN DESARROLLO
Guía interna por categorías con búsqueda y acceso directo a cada módulo. Este manual es su fuente documental inicial.

### Feedback y soporte — DISPONIBLE
Asistente de primera atención, escalamiento a soporte humano e ideas/mejoras con estado.

## Multi-propiedad y alquiler vacacional

Objetivo: servir al mismo tiempo a un hotel tradicional y a un operador que administra unidades Airbnb en distintas direcciones.

Modelo:

```text
Workspace / Cartera
  ├─ Propiedad: Hotel A
  │    └─ habitaciones
  ├─ Propiedad: Departamento Palermo
  │    └─ unidad
  └─ Propiedad: Edificio Córdoba
       ├─ unidad 1
       ├─ unidad 2
       └─ unidad 3
```

Reglas:
- cada dirección puede ser una propiedad independiente;
- un edificio puede agrupar varias unidades;
- cada propiedad conserva tarifas, impuestos, canales, accesos, caja y reglas;
- Cartera agrega lectura y priorización, no cruza inventarios;
- los roles deben evolucionar a alcance por propiedad/cartera;
- la interfaz podrá adaptar “Habitación” a “Unidad” según el tipo de operación;
- siguientes capas: Planning multi-propiedad, rutas de limpieza/mantenimiento, finanzas consolidadas, inbox OTA unificado y reglas globales con override por propiedad.

## Procedimientos frecuentes

### Inicio de turno
1. Confirmar propiedad activa.
2. Revisar Dashboard y Operación ahora.
3. Abrir/verificar Caja diaria si corresponde.
4. Revisar llegadas, habitaciones pendientes, saldos y novedades.

### Llegada
1. Abrir reserva.
2. Confirmar identidad, acompañantes y datos.
3. Revisar Housekeeping/Mantenimiento de la habitación.
4. Revisar garantía/saldo.
5. Hacer check-in y dejar notas relevantes.

### Salida
1. Revisar folios/pagadores/saldo.
2. Resolver cargos o devoluciones.
3. Hacer check-out de habitación o grupo.
4. Verificar liberación hacia Housekeeping.

### Incidencia de habitación
1. Crear/abrir Mantenimiento.
2. Definir prioridad e impacto.
3. Bloquear venta si corresponde.
4. Reubicar huésped sólo mediante el flujo controlado.
5. Resolver y liberar inventario.

### Pase de turno
1. Mantener actualizado el Libro de novedades.
2. Contar efectivo y revisar diferencias.
3. Dejar pendientes concretos.
4. Cerrar caja y compartir reporte cuando corresponda.

## Prioridades competitivas aprobadas

1. CRM y fidelización.
2. Payments Automation.
3. API real.
4. Permisos granulares.
5. Channel Manager Health Center.
6. Revenue con señales externas/autopilot, promociones/paquetes, agencias/empresas/comisiones, lista de espera, optimizador de inventario y check-in OCR/pago/acceso.
7. Contabilidad visible, reportes programados, reputación, cerraduras y madurez multi-propiedad.

Dirección: **solidez operativa de Hotelgest + profundidad comercial/CRM de PxSol + una interfaz más limpia, conectada y fácil de aprender.**