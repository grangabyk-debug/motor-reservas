# Habitación Llena PMS Next — manual de producto, UX y responsive

## 1. Principio rector

Habitación Llena debe sentirse como un sistema operativo moderno: **simple, predecible, rápido y agradable**, aunque internamente coordine reservas, cobros, huéspedes, housekeeping, mantenimiento, distribución e IA.

La interfaz no expone complejidad técnica. Expone únicamente la decisión o acción que la persona necesita en ese momento.

## 2. Lenguaje visual

### Materiales
- Fondos mayormente neutros y claros.
- Glass/transparencia solamente para jerarquía: shell, barras flotantes, sheets, overlays, paneles destacados y navegación.
- No aplicar blur indiscriminadamente a cada tarjeta.
- Bordes suaves, radios generosos y sombras discretas.
- Espacio en blanco amplio para bajar carga cognitiva.

### Color
Los estados operativos usan tres colores semánticos principales:
- **Verde**: listo, resuelto, cobrado, disponible, correcto.
- **Amarillo**: pendiente, atención, proceso, espera, requiere revisión.
- **Rojo**: error, deuda crítica, bloqueo, incidencia urgente, cierre/problemática.

El resto de la interfaz se mantiene neutral. El color de marca puede utilizarse para selección, foco y CTA principal, pero no debe competir con los estados semánticos.

No asignar un color distinto a cada módulo sólo para diferenciarlos. La jerarquía sale de iconografía, tipografía, ubicación y estado.

### Tipografía
- Títulos claros, pocas palabras y fuerte contraste jerárquico.
- Evitar bloques de instrucciones permanentes si pueden resolverse con contexto, tooltip o ayuda.
- Datos clave grandes; metadatos secundarios discretos.
- Nunca reducir texto para “hacer entrar” más información: reordenar o simplificar.

## 3. Movimiento y sensación

Habitación Llena puede sentirse viva, incluso con cierta respuesta “de videojuego”, sin transformarse en una interfaz lúdica.

### Permitido
- Entrada/salida de sheets y modales.
- Reordenamiento suave de colas.
- Confirmación visual al completar tareas.
- Microrebote/spring corto en acciones importantes.
- Transición al cambiar estado de habitación/reserva.
- Skeletons y progresos que expliquen que algo está ocurriendo.
- Contadores y badges que actualizan de forma visible pero discreta.

### Regla temporal
- Microinteracciones: aproximadamente 120–180 ms.
- Cambios de panel/sheet: aproximadamente 180–260 ms.
- Nada esencial debe hacer esperar a una animación.
- Respetar `prefers-reduced-motion`.

### Prohibido
- Animaciones decorativas permanentes que distraigan.
- Movimiento que cambie la ubicación del CTA mientras el usuario intenta tocarlo.
- Efectos largos para acciones repetitivas de recepción/housekeeping.

## 4. Responsive como requisito funcional

No existe una “versión móvil recortada”. Existe el mismo producto adaptado al contexto de uso.

### Móvil
- Un solo objetivo principal por pantalla.
- Bottom dock para accesos frecuentes y sheet para el resto.
- Touch targets mínimos cercanos a 44 × 44 px.
- Formularios en una columna.
- Acciones críticas accesibles con el pulgar.
- Detalles secundarios en sheets o acordeones.
- No depender de hover.
- Housekeeping/Mantenimiento deben poder operarse caminando con el teléfono.

### Tablet
- Sidebar o rail compacto.
- Puede haber panel maestro/detalle cuando mejora velocidad.
- Touch sigue siendo la interacción primaria posible.

### Desktop
- Sidebar persistente.
- Mayor densidad únicamente cuando agrega contexto real.
- Planning, reportes y gestión pueden aprovechar ancho completo.
- Evitar llenar el espacio con tarjetas sólo porque hay lugar.

## 5. Contrato obligatorio para cada botón/CTA

Un control visible tiene que responder estas preguntas:

1. **¿Qué intención representa?**
2. **¿El rol actual puede ejecutarla?**
3. **¿Tiene los datos necesarios?**
4. **¿Qué acción real dispara?**
5. **¿Qué sucede si sale bien?**
6. **¿Qué sucede si falla?**
7. **¿A qué pantalla/entidad lleva si navega?**
8. **¿Queda auditada si corresponde?**

Si no existe una acción real todavía, el control no debe simular funcionalidad. Se oculta o se presenta explícitamente como capacidad no habilitada, sin enviarlo a destinos falsos.

## 6. Estados obligatorios de una vista

Toda vista conectada a datos debe contemplar:
- loading;
- contenido;
- empty state útil;
- error recuperable;
- permiso insuficiente;
- éxito/confirmación después de una acción.

Un error debe explicar qué puede hacer el usuario, no solamente mostrar un código técnico.

## 7. Patrón de información por rol

### Recepción
Ve lo que requiere atención **ahora**: llegadas, salidas, habitaciones pendientes, saldos, peticiones y excepciones.

### Housekeeping
Ve cola, prioridad, habitación, tarea y bloqueos. No necesita finanzas ni datos comerciales.

### Mantenimiento
Ve incidencia, activo/ubicación, prioridad, responsable, historial y bloqueo operativo.

### Revenue
Ve demanda, pickup, inventario, tarifas, canales y recomendaciones.

### Gerencia
Ve resumen y excepciones; profundiza únicamente cuando lo necesita.

La complejidad se libera por contexto y permiso, no mostrando todo a todos.

## 8. Patrón de navegación contextual

La navegación lateral sirve para cambiar de área. Las relaciones de negocio se abren en contexto.

Ejemplos:
- Reserva -> huésped, cobro, conversación, housekeeping, mantenimiento.
- Petición -> reserva/habitación de origen.
- Habitación -> limpieza, incidencias y próxima llegada.
- Pago -> reserva/folio y caja correspondiente.

No obligar al usuario a volver al menú principal para completar una secuencia lógica.

## 9. IA dentro del producto

La IA no debe vivir como un muñeco flotante desconectado del PMS.

Puede presentarse como:
- sugerencia contextual;
- resumen;
- botón “Preguntar”; 
- comando en lenguaje natural;
- recomendación dentro del flujo;
- agente de conversación.

Pero siempre trabaja sobre herramientas autorizadas y datos reales.

### Presentación de acciones IA
Toda acción propuesta muestra:
- qué entendió;
- qué quiere hacer;
- sobre qué reserva/huésped/habitación;
- si necesita aprobación;
- resultado posterior.

La IA nunca inventa un estado operativo que no exista en base.

## 10. Formularios y entrada de datos

- Pedir primero lo indispensable.
- Completar automáticamente lo inferible de la reserva/huésped.
- Recordar preferencias por propiedad cuando sea seguro.
- Agrupar campos por decisión, no por estructura de base de datos.
- Validación inmediata y clara.
- Guardado visible; nunca hacer creer que se guardó si todavía no ocurrió.

## 11. Accesibilidad y operación real

- Contraste suficiente en día y noche.
- Foco de teclado visible.
- Labels/aria en icon buttons.
- No usar sólo color para comunicar estado: sumar icono/texto.
- Acciones destructivas requieren confirmación apropiada.
- Evitar targets diminutos en Planning y paneles móviles.

## 12. Criterio Apple aplicado a Habitación Llena

No se trata de copiar iOS visualmente. Se copia la filosofía:
- pocas decisiones visibles a la vez;
- estados claros;
- feedback inmediato;
- animación que explica continuidad;
- profundidad progresiva;
- consistencia entre pantallas;
- defaults inteligentes;
- configuración avanzada disponible, pero fuera del camino diario.

## 13. QA visual obligatorio por entrega

Cada módulo se revisa como mínimo en:
- móvil angosto;
- móvil grande;
- tablet;
- notebook;
- desktop ancho;
- modo día;
- modo noche cuando aplique;
- mouse/teclado;
- touch.

Además se comprueba:
- textos sin corte;
- sheets/modales dentro del viewport;
- botones tocables;
- scroll correcto;
- estados semánticos coherentes;
- no hay acciones esenciales sólo por hover;
- no hay controles decorativos sin funcionalidad.

## 14. Regla final

**Si una función necesita explicación larga para poder usarse, primero intentar simplificar la función.**

La documentación sirve para operación, soporte y arquitectura. La interfaz diaria debe poder aprenderse usándola.
