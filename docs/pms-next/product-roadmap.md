# Habitación Llena PMS Next — roadmap de producto

> Fuente de verdad de ejecución. Rama: `pms-rebuild-zero`. Actualizado 13/09/2026 después de la revisión competitiva contra Hotelgest y PxSol.

## Norte de producto

**Solidez operativa de Hotelgest + profundidad comercial/CRM de PxSol + una interfaz más limpia, conectada y fácil de aprender.**

Habitación Llena ya tiene una base operativa madura en Planning, Reservas, grupos, Housekeeping, Mantenimiento, Caja, folios, tarifas e inteligencia. El siguiente salto no es sumar botones de recepción: es conseguir que el sistema **venda más, cobre mejor, reconozca al huésped, automatice tareas y avise cuando algo requiere intervención**.

## Reglas transversales

1. Visual y funcionamiento se desarrollan juntos.
2. Ningún botón visible queda sin acción real, permiso, feedback y estado de error.
3. Toda función visible debe entrar al sitemap y al manual.
4. No duplicar módulos cuando la capacidad pertenece a uno existente.
5. Cada acción sensible respeta `property_id`, roles, auditoría y confirmación.
6. Multi-propiedad agrega una capa de cartera; no mezcla inventarios ni duplica el PMS.
7. Cada entrega pasa desktop/tablet/móvil y modo día/noche cuando corresponda.
8. Antes de automatizar dinero, cancelaciones, inventario o tarifas, primero existe un flujo manual seguro y auditable.

---

# Fase 0 — Cimientos de producto, documentación y multi-propiedad

**Estado: EN EJECUCIÓN.**

### Incluye
- sitemap operativo con guard de build;
- manual funcional vivo + PDF de capacitación;
- Centro de ayuda categorizado;
- Feedback y soporte;
- vista **Cartera** para varias propiedades;
- modelo `Workspace/Cartera -> Propiedades -> Habitaciones/Unidades`;
- revisión progresiva de duplicaciones y arquitectura sin refactors masivos innecesarios.

### Multi-propiedad
Un hotel puede ser una propiedad con muchas habitaciones. Un anfitrión de Airbnb puede tener cada dirección como propiedad independiente. Un edificio puede ser una propiedad con varias unidades. Todas usan los mismos motores de Reservas, Planning, Housekeeping, Finanzas, Revenue y Canales; Cartera agrega visión central.

### Siguiente evolución
Planning multi-propiedad, operación por dirección, rutas de limpieza/mantenimiento, finanzas consolidadas, inbox OTA unificado, defaults de workspace con override por propiedad y permisos por alcance.

---

# Fase 1 — CRM y fidelización

**Prioridad: CRÍTICA.**

La base de huéspedes ya guarda recurrencia, VIP, preferencias, cumpleaños, idioma, contacto e historial. Hay que transformarla en acción comercial.

### Entregables
- perfil 360 de huésped;
- segmentos guardados;
- cumpleaños y fechas relevantes;
- recurrentes / dormidos / alto valor / canal habitual / familias / empresas;
- campañas email/mensajería;
- automatizaciones pre-estadía, durante, post-estadía y reactivación;
- consentimiento y exclusión;
- métricas apertura/clic/conversión cuando el canal lo permita;
- fidelización e incentivos de reserva directa.

---

# Fase 2 — Payments Automation

**Prioridad: CRÍTICA.**

### Entregables
- depósitos configurables;
- garantías;
- links/cobros programados;
- penalidades por cancelación/No Show;
- reintentos;
- devoluciones;
- conciliación;
- timeline financiero de la reserva;
- alertas por cobro fallido;
- reglas por tarifa/canal;
- conectores PSP desacoplados de la lógica hotelera.

---

# Fase 3 — API real y plataforma abierta

**Prioridad: CRÍTICA.**

### Entregables
- API keys reales;
- scopes (`reservations:read`, `rates:write`, etc.);
- revocación;
- rate limits;
- logs;
- sandbox;
- documentación;
- webhooks versionados para reservas, pagos, check-in/out, habitaciones y otras entidades.

La pantalla no debe mostrar una falsa capacidad productiva mientras siga marcada como “Próximamente”.

---

# Fase 4 — Permisos granulares

**Prioridad: ALTA.**

La estructura de roles/permisos existente evoluciona a una matriz por acción.

Ejemplos: crear reserva, modificar tarifa, aplicar descuento, cancelar, anular pago, cerrar caja, ver finanzas, cambiar inventario OTA, administrar usuarios. Debe soportar permisos por propiedad y, más adelante, por cartera.

---

# Fase 5 — Channel Manager Health Center

**Prioridad: ALTA.**

No sumar canales antes de mejorar observabilidad.

### Entregables
- último ARI enviado;
- última reserva recibida;
- estado de mapping;
- errores por habitación/tarifa/canal;
- reservas rechazadas;
- cola y reintentos;
- inconsistencias PMS-OTA;
- historial y diagnóstico explicable.

---

# Fase 6 — Segunda ola comercial y operativa

Puede ejecutarse por cortes independientes después de estabilizar 1-5.

### Revenue avanzado
- señales confiables de mercado/competencia;
- impacto estimado;
- aplicar/modificar/ignorar;
- autopilot posterior con piso/techo, límites y auditoría.

### Motor de reservas comercial
- códigos promocionales;
- paquetes;
- upselling pre-arrival;
- recuperación de abandono;
- Google Hotel Ads / Free Booking Links;
- motor multi-propiedad.

### Empresas, agencias y comisiones
- cuentas corporativas;
- tarifas negociadas;
- crédito/cuenta corriente;
- comisión por agencia;
- estados pendientes/pagados;
- facturación consolidada.

### Lista de espera
- solicitud por fechas/tipo/pax;
- coincidencia automática al liberarse inventario;
- conversión a cotización/reserva sin bloquear cupo.

### Optimizador de Planning
- detectar fragmentación de inventario;
- proponer movimientos;
- estimar ingreso recuperable;
- aplicar sólo con confirmación y auditoría.

### Check-in online
La base actual ya cubre datos, acompañantes, documentos, preferencias, servicios, mascotas, vehículos y firma. Próximos cortes: OCR, garantía/pago y acceso/PIN/llave digital.

---

# Fase 7 — Madurez empresarial

- contabilidad visible o exportación contable de primera clase;
- constructor de informes y envíos programados;
- reputación/encuestas y desvío de casos negativos a resolución interna;
- integraciones reales con cerraduras;
- Cartera avanzada y finanzas consolidadas;
- inbox OTA/mensajería unificado;
- reglas globales de workspace con overrides por propiedad.

---

# Capacidades que continúan evolucionando en paralelo

El grafo operativo ya conecta Reserva, Huésped, Habitación, Mensajes, Housekeeping, Mantenimiento y Pagos. Se sigue profundizando en navegación bidireccional, timeline, solicitudes, acciones compartidas y agente operativo, sin frenar las prioridades comerciales anteriores.

Housekeeping y Mantenimiento pueden sumar priorización, tiempos, autoasignación, activos, preventivos e inteligencia, pero sin crear módulos duplicados.

---

# Definition of Done

Una entrega sólo se considera terminada cuando:
- usa datos reales y respeta multitenancy;
- tiene loading/empty/error/success;
- respeta rol y permiso;
- las acciones principales tienen feedback;
- no hay controles decorativos sin función;
- funciona con mouse, teclado y touch;
- pasa móvil/tablet/desktop;
- día/noche es legible;
- acciones sensibles quedan auditadas;
- no rompe Planning, Reservas, Caja ni Operación;
- el sitemap y el manual se actualizan en la misma entrega cuando cambia una capacidad visible.