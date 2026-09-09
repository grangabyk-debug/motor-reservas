# Habitación Llena PMS Next — roadmap por paquetes

> Fuente de verdad de ejecución. Rama de trabajo: `pms-rebuild-zero`.

## Objetivo de producto

Habitación Llena debe comportarse como un sistema operativo del hotel: simple por fuera, profundo por dentro. El sistema tiene que reducir trabajo manual, conectar las áreas sin usar a Recepción como intermediario y conservar trazabilidad de cada acción.

Regla central: **menos tiempo usando el PMS, más tiempo atendiendo el hotel y al huésped**.

## Reglas de ejecución

1. No se abre un módulo nuevo si una capacidad puede resolverse contextualmente dentro de uno existente.
2. Ningún botón visible queda sin acción real, destino correcto, permiso, feedback y estado de error.
3. Toda información de negocio mantiene `property_id` y relaciones por IDs estables.
4. Una reserva, huésped, habitación, pago, conversación, petición y tarea deben poder cruzarse sin duplicar datos.
5. Primero se construye el contrato de datos/acciones; después la interfaz.
6. La IA propone o ejecuta únicamente acciones disponibles mediante herramientas explícitas y permisos.
7. Acciones financieras, destructivas o de alto impacto requieren confirmación humana hasta que exista una política configurable y auditada.
8. Cada paquete debe cerrar con QA desktop + tablet + móvil y sin accesos muertos.

---

## Paquete 0 — Sistema de producto y fuente de verdad

**Estado:** iniciado.

### Objetivo
Evitar que el PMS crezca como una colección de pantallas desconectadas.

### Entregables
- Sitemap operativo vivo.
- Mapa de conexiones entre módulos.
- Manual UX/UI y responsive.
- Contrato obligatorio para cada CTA y cada vista.
- Validador automático de navegación/sitemap antes del build.
- Criterio de finalización común para todos los paquetes.

### Terminado cuando
- Cada `view` navegable tiene workspace real.
- Cada `view` tiene descripción y entrada en sitemap.
- No existen IDs duplicados ni vistas huérfanas.
- El build de PMS Next falla si se rompe ese contrato.

---

## Paquete 1 — Grafo operativo del hotel

### Objetivo
Conectar de forma canónica las piezas que ya existen: **Mensajes + Reserva + Huésped + Habitación + Housekeeping + Mantenimiento + Pagos**.

### Entidades núcleo
- `guest`
- `reservation`
- `room`
- `folio/payment`
- `conversation`
- `guest_request`
- `operational_task`
- `maintenance_issue`

### Entregables
- Servicio único de `OperationalContext` que, dado un `reservation_id`, pueda resolver huésped, habitación actual, estadía, saldo, conversación y trabajo operativo relacionado.
- Acciones compartidas con contratos claros: crear petición, crear tarea, asignar área, cambiar prioridad, resolver, añadir nota y navegar a la entidad de origen.
- Historial operativo unificado por reserva/habitación.
- Eventos internos consistentes: `guest_request.created`, `task.created`, `task.assigned`, `task.completed`, `maintenance.created`, `payment.received`, etc.

### Terminado cuando
Desde una reserva se puede ver y abrir todo lo operativo relacionado y, desde una tarea/petición, volver a la reserva o habitación correcta sin búsquedas manuales.

---

## Paquete 2 — Inbox inteligente y contexto de huésped

### Objetivo
Convertir Mensajes en el punto único de conversación, no en otra bandeja aislada.

### Fase 2A — sin depender de Meta
- Web chat / conversación interna.
- Hilo asociado automáticamente a huésped y reserva.
- Panel lateral con fechas, habitación, estado, saldo, idioma, preferencias y alertas.
- Clasificación de intención: reserva, pago, housekeeping, mantenimiento, información, reclamo, early/late, cambio/cancelación.
- Traducción y resumen asistidos.
- Respuestas sugeridas por IA, con envío humano inicialmente.
- Detección de sentimiento y urgencia.

### Fase 2B — acciones desde la conversación
- Crear petición a Housekeeping.
- Crear incidencia a Mantenimiento.
- Solicitar/registrar early o late check-in/out.
- Generar solicitud/enlace de pago cuando el PSP lo permita.
- Crear presupuesto o llevar al flujo de reserva.

### Terminado cuando
Recepción no tiene que copiar una consulta del huésped a otro módulo: el mensaje dispara o propone la acción correcta y queda todo relacionado.

---

## Paquete 3 — Agente operativo de Habitación Llena

### Objetivo
Pasar de “chat que responde” a **agente que trabaja con herramientas reales**.

### Herramientas iniciales
- `find_reservation`
- `get_guest_context`
- `get_room_status`
- `get_balance`
- `create_guest_request`
- `create_housekeeping_task`
- `create_maintenance_issue`
- `add_reservation_note`
- `create_quote`
- `request_payment`
- `suggest_early_late_action`

### Seguridad
- Lecturas: automáticas según rol.
- Operaciones reversibles: automáticas si la política lo permite.
- Dinero, cancelaciones, movimientos de habitación y cambios tarifarios: aprobación humana por defecto.
- Toda acción del agente queda en Actividad/Auditoría con actor, herramienta, parámetros y resultado.

### Terminado cuando
Una conversación del huésped puede convertirse en trabajo real del hotel sin que Recepción actúe como “copiar y pegar humano”.

---

## Paquete 4 — Housekeeping Intelligence

### Objetivo
Que Housekeeping trabaje con una cola simple, priorizada automáticamente y usable con una mano desde el teléfono.

### Entregables
- Priorización por salida, próxima llegada, early check-in, VIP/incidencia y tiempo disponible.
- Autoasignación configurable por piso/zona/carga.
- Tiempo iniciado / estimado / real por habitación.
- Estado: pendiente → en limpieza → inspección → lista.
- Voz a acción: “terminé la 204, falta un toallón y el aire no enfría”.
- Separación automática de la frase en limpieza, reposición y mantenimiento.
- Alertar a Recepción únicamente cuando requiere intervención.

### Terminado cuando
El equipo puede operar desde móvil sin navegar múltiples pantallas y Recepción sólo recibe excepciones.

---

## Paquete 5 — Mantenimiento Intelligence

### Objetivo
Evolucionar de incidencias sueltas a gestión del activo y prevención.

### Entregables
- Registro de activos por habitación/área.
- QR opcional por activo.
- Historial de fallas, reparaciones, repuestos, costo y tiempo fuera de servicio.
- Mantenimiento preventivo periódico.
- Detección de reincidencias.
- Recomendación de revisión/reemplazo basada en frecuencia y costo.
- Impacto operativo: habitaciones/noches afectadas.

### Terminado cuando
Mantenimiento puede responder qué falla, cuánto cuesta, cuánto se repite y qué conviene prevenir.

---

## Paquete 6 — Front desk por excepción

### Objetivo
Automatizar burocracia para devolver a Recepción su rol de hospitalidad.

### Entregables
- Pre check-in y datos previos.
- Documentos/firma según factibilidad legal e integración.
- Pago previo o garantía.
- Cola de huéspedes “listos para llegar”.
- Check-in rápido con mínimos toques.
- Check-out autónomo/asistido.
- Al check-out: disparo automático a Housekeeping.
- Night Audit automático con bandeja de excepciones.

### Terminado cuando
El turno no necesita ejecutar manualmente procesos repetitivos salvo excepciones reales.

---

## Paquete 7 — Revenue Copilot

### Objetivo
Que Revenue deje de ser sólo reportes y se convierta en recomendación accionable y explicable.

### Entregables
- Pickup, pace, ocupación, ADR, RevPAR, cancelación y ventana de reserva.
- Comparación con períodos equivalentes.
- Señales externas cuando existan fuentes confiables.
- Recomendación de tarifa/restricción con explicación e impacto estimado.
- Aplicar / modificar / ignorar.
- Historial de recomendaciones y resultado.
- Modo automático solamente posterior, configurable y con límites.

---

## Paquete 8 — Canales de conversación y WhatsApp

### Objetivo
Conectar el agente construido en los paquetes 2 y 3 a canales externos sin atar la inteligencia a un proveedor.

### Arquitectura
`Canal externo -> adaptador -> Conversaciones HL -> Agente/Herramientas -> PMS`

### Orden
1. Web chat propio.
2. Email/OTA donde haya APIs útiles.
3. WhatsApp mediante BSP compatible para primeras propiedades.
4. Meta Tech Provider / Embedded Signup cuando el volumen lo justifique.

### Regla
La lógica de IA, contexto y automatización es de Habitación Llena. Twilio, 360dialog, Meta u otro proveedor son adaptadores reemplazables.

---

## Paquete 9 — Plataforma abierta e inventario universal

### Objetivo
Convertir Habitación Llena en plataforma y no en software cerrado.

### Entregables
- REST API estable y versionada.
- Webhooks por eventos de negocio.
- Credenciales/scopes por integración.
- Marketplace de apps.
- Inventario vendible más allá de habitaciones: cochera, spa, salón, actividad, transfer, late checkout, experiencias y recursos.

---

# Orden obligatorio

`0 -> 1 -> 2 -> 3 -> 4/5 -> 6 -> 7 -> 8 -> 9`

Housekeeping y Mantenimiento pueden avanzar en paralelo después del paquete 3. WhatsApp no debe adelantar al Inbox/Agente: primero construimos el cerebro y después conectamos canales.

# Definition of Done global

Un paquete sólo se considera terminado cuando:

- usa datos reales de la propiedad;
- respeta roles/permisos;
- tiene estados loading/empty/error/success;
- acciones principales tienen feedback visible;
- no hay botones decorativos o sin destino;
- los enlaces contextuales vuelven a la entidad correcta;
- genera auditoría cuando corresponde;
- funciona con mouse, teclado y touch;
- pasa móvil, tablet y desktop;
- no depende de hover para una acción esencial;
- mantiene estados semánticos coherentes;
- pasa validadores de arquitectura, visuales y sitemap;
- no rompe flujos existentes del Planning, Reservas, Caja ni Operaciones.
