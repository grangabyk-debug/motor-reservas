# Habitación Llena — manual funcional v0.4

> Documento vivo para capacitación, soporte y control interno. Fecha: 13/09/2026. Esta versión consolida el estado funcional después de CRM, Payments Automation, REST API v1, permisos granulares, Health Center y la evolución multi-propiedad.

## Estados

- **DISPONIBLE**: utilizable hoy.
- **EN DESARROLLO**: existe una base real y utilizable, pero faltan capas antes de considerarla cerrada.
- **PLANIFICADO**: dirección aprobada; no debe venderse como disponible.

## Regla de interfaz

Habitación Llena prioriza operación simple: **estado + dato importante + acción**. La explicación larga vive en Ayuda/manual, no en la pantalla diaria. La configuración avanzada aparece sólo cuando la persona la necesita.

## Conceptos básicos

Habitación Llena trabaja siempre sobre una **propiedad activa**. Una cuenta puede acceder a varias propiedades sin mezclar reservas, caja, inventario ni canales. La navegación lateral cambia de área y los vínculos contextuales conectan reserva, huésped, habitación/unidad, pagos, mensajes, housekeeping y mantenimiento.

### Dashboard — DISPONIBLE
Resumen en vivo de ocupación, llegadas, salidas, huéspedes, habitaciones listas, cobros y alertas. Es el punto recomendado para comenzar el turno.

### Cartera multi-propiedad — EN DESARROLLO
Vista central para operadores con varios hoteles, edificios, departamentos, casas o cabañas. Consolida ocupación, llegadas, salidas, limpieza y mantenimiento sin mezclar inventarios.

La sección **Pendientes ahora** prioriza tareas por propiedad y permite abrir directamente el módulo correcto. Cada propiedad puede guardar su **tipo operativo** y **dirección**, útil para operadores de alquiler vacacional que administran unidades en ubicaciones diferentes.

Modelo: **Cuenta/Cartera → Propiedades → Habitaciones o Unidades**.

### Planning — DISPONIBLE
Calendario central de disponibilidad y reservas. Permite crear reservas individuales y grupales, mover y extender, gestionar tramos, ver estados/pagos y bloquear inventario por mantenimiento, uso interno, fuera de servicio, cortesía, grupo u otros motivos.

La selección grupal usa el mismo orden visible de habitaciones que muestra el Planning, evitando incluir habitaciones intermedias que el usuario no seleccionó.

### Reservas — DISPONIBLE
Ficha completa con titular, acompañantes, fechas, canal, habitaciones, saldo, pagos, documentos, notas e historial. Incluye reservas grupales, salida por habitación, cancelación parcial, extensiones, No Show, folios/pagadores y redistribución de cargos.

El sistema reconoce perfiles ya existentes para reutilizar datos del pasajero y advierte posibles reservas duplicadas cuando coinciden datos/nombre y fechas de forma sospechosa.

### Presupuestos — DISPONIBLE
Cotizaciones previas a la reserva con fechas, habitaciones/tipos, tarifas y condiciones, convertibles a reserva.

### Huéspedes — DISPONIBLE
Directorio CRM con perfil 360°, historial, contacto, documento, idioma, etiquetas, VIP, preferencias, notas, cumpleaños, recurrencia, canal habitual, próxima estadía y valor histórico por moneda.

### CRM y fidelización — EN DESARROLLO
Ya están disponibles los segmentos vivos: recurrentes, muy frecuentes, VIP/Signature, cumpleaños próximos, próxima estadía, reactivación, OTA recurrentes y nuevos.

El perfil permite registrar **consentimiento comercial separado para Email y WhatsApp**. También muestra oportunidades contextuales simples, por ejemplo cumpleaños del día. Campañas masivas y automatizaciones comerciales todavía no se consideran cerradas.

### Pre check-in — DISPONIBLE
Panel de próximas llegadas con datos pendientes, validación y generación de enlace de pre check-in. Recepción interviene sólo cuando falta algo o aparece una excepción.

### Mensajes — DISPONIBLE
Conversaciones vinculadas a huésped/reserva y navegación contextual a entidades operativas. Base del inbox inteligente.

### Caja diaria — DISPONIBLE
Apertura por responsable/turno, cobros, movimientos, arqueo, cierres e historial. El **Libro de novedades** puede editarse durante el turno y su versión vigente se adjunta al cierre, PDF y email.

### Finanzas — DISPONIBLE
Saldos, pagos, documentos, solicitudes y folios. Soporta varios pagadores y división/redistribución de cargos.

### Payments Automation — EN DESARROLLO
Existe un centro operativo real dentro de Finanzas para solicitudes de cobro, garantías, depósitos, conciliación y excepciones.

Puede crear links Mercado Pago para reservas compatibles, verificar su estado y conciliar cuando el proveedor confirma el pago. Prioriza cobros fallidos/vencidos, garantías, depósitos retenidos y saldos de llegadas próximas. Penalidades, reintentos automáticos y devoluciones automáticas sensibles siguen requiriendo una capa adicional.

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
Construcción del sitio y motor de reserva directa conectado al inventario.

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
Infraestructura de sincronización de disponibilidad, tarifas, restricciones y reservas por propiedad. Los mapeos y monedas deben revisarse antes de activar cada canal.

### Health Center del Channel Manager — DISPONIBLE
Resumen compacto del estado de sincronización con cuatro señales principales: **General, Última sync, Cola y Conflictos**.

El diagnóstico expandido muestra sólo lo necesario: mapeos, flujo PMS → OTA, OTA → PMS y sincronización. Si existe una incidencia, el botón **Resolver** abre el administrador del canal correspondiente. Los datos salen de inbox, outbox, sync runs, acciones, errores y reintentos reales.

### Equipo — DISPONIBLE
Usuarios y roles por propiedad.

### Permisos granulares — EN DESARROLLO
Además de visibilidad por módulo, existe una vista **Módulos / Acciones**. El primer corte protege también en backend acciones sensibles como:

- crear link de cobro;
- verificar y conciliar cobros;
- administrar claves API;
- invitar usuarios.

La matriz seguirá creciendo hacia tarifas, descuentos, cierres, canales e informes sensibles.

### Actividad — DISPONIBLE
Auditoría de acciones y cambios.

### Configuración — DISPONIBLE
Preferencias de propiedad, branding, reglas y features.

### Puesta en marcha — DISPONIBLE
Checklist de implementación.

### Apps externas — DISPONIBLE
Área de conectores.

### REST API v1 — EN DESARROLLO
Existe una API real por propiedad. Propietarios/roles autorizados pueden crear claves con secreto visible una sola vez, hash persistido, scope, vencimiento, rate limit, auditoría y revocación.

Primer endpoint productivo:

```http
GET /api/v1/reservations
Authorization: Bearer HL_API_KEY
```

Primer scope: `reservations:read`. Soporta filtros por fechas/estado y paginación simple. Los webhooks todavía no están disponibles; antes de mostrarlos deben tener firma, reintentos e historial.

### Centro de ayuda — DISPONIBLE
Ayuda interna con búsqueda, categorías, procedimientos rápidos y acceso directo al módulo correspondiente. Se mantiene alineada con este manual.

### Feedback y soporte — DISPONIBLE
Soporte humano, conversaciones e ideas/mejoras con seguimiento.

## Multi-propiedad y alquiler vacacional

Habitación Llena usa el mismo PMS para un hotel tradicional y para un operador de Airbnb/alquiler vacacional.

```text
Cartera
  ├─ Hotel / Hostería
  │    └─ habitaciones
  ├─ Departamento en una dirección
  │    └─ unidad
  └─ Edificio
       ├─ unidad 1
       ├─ unidad 2
       └─ unidad 3
```

Reglas actuales:
- cada dirección puede ser una propiedad independiente;
- un edificio puede agrupar varias unidades;
- cada propiedad conserva tarifas, impuestos, canales, accesos, caja y reglas;
- Cartera agrega lectura, prioridad y accesos rápidos sin cruzar inventarios;
- tipo y dirección permiten identificar correctamente propiedades dispersas;
- roles y permisos se mantienen por propiedad;
- las próximas capas son Planning transversal, rutas de limpieza/mantenimiento, finanzas consolidadas e inbox OTA unificado.

## Procedimientos frecuentes

### Inicio de turno
1. Confirmar propiedad activa.
2. Revisar Dashboard y Operación ahora.
3. Abrir/verificar Caja diaria si corresponde.
4. Revisar llegadas, habitaciones pendientes, saldos y novedades.

### Llegada
1. Abrir reserva.
2. Confirmar identidad, acompañantes y datos.
3. Si el huésped ya existe, reutilizar su perfil en lugar de duplicarlo.
4. Revisar Housekeeping/Mantenimiento de la habitación.
5. Revisar garantía/saldo.
6. Hacer check-in y dejar notas relevantes.

### Salida
1. Revisar folios/pagadores/saldo.
2. Resolver cargos o devoluciones.
3. Hacer check-out de habitación o grupo.
4. Verificar liberación hacia Housekeeping.

### Posible reserva duplicada
1. Revisar la advertencia del sistema.
2. Comparar fechas, huésped, email/teléfono y canal.
3. Confirmar si son reservas distintas o duplicadas.
4. Si corresponde, fusionar/regularizar sin eliminar historial operativo.

### Incidencia de habitación
1. Crear/abrir Mantenimiento.
2. Definir prioridad e impacto.
3. Bloquear venta si corresponde.
4. Reubicar huésped mediante el flujo controlado.
5. Resolver y liberar inventario.

### Pase de turno
1. Mantener actualizado el Libro de novedades.
2. Contar efectivo y revisar diferencias.
3. Dejar pendientes concretos.
4. Cerrar caja y compartir reporte cuando corresponda.

## Prioridades competitivas siguientes

1. Completar CRM: campañas, segmentos guardados y automatizaciones comerciales.
2. Completar Payments Automation: reintentos, penalidades/devoluciones y conciliación avanzada.
3. Webhooks y expansión de REST API.
4. Ampliar permisos granulares a todas las acciones sensibles.
5. Revenue con señales externas/autopilot.
6. Promociones/paquetes, agencias/empresas/comisiones, lista de espera y optimizador de inventario.
7. Check-in online con OCR/pago/acceso.
8. Contabilidad visible, reportes programados, reputación, cerraduras y madurez multi-propiedad.

Dirección: **solidez operativa de Hotelgest + profundidad comercial/CRM de PxSol + una interfaz más limpia, conectada y fácil de aprender.**
