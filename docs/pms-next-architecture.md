# Habitación Llena — PMS Next

## Objetivo
Construir una nueva interfaz PMS desde cero, aislada de la versión actualmente utilizada. La versión existente no se modifica ni se reemplaza mientras PMS Next esté en desarrollo.

## Reglas de aislamiento
- Rama de trabajo: `pms-rebuild-zero`.
- Ruta de laboratorio: `/pms-next`.
- No importar componentes visuales de `app/dashboard`.
- No modificar `main`, producción ni el dashboard actual durante esta etapa.
- No mezclar código de ramas experimentales anteriores (`heroes-migration`, `feat/habitacion-llena-liquid-shell`).
- Todo cambio debe compilar y pasar los guards del repositorio antes de considerarse listo.

## Qué sí se puede reutilizar
Cuando llegue la conexión real a datos, se podrán reutilizar únicamente primitivas de infraestructura que ya sean correctas y auditables, por ejemplo autenticación, cliente Supabase, validación de tenant y contratos de servicios. La interfaz, navegación, layouts y componentes funcionales de PMS Next permanecen independientes.

## Estructura
```
app/pms-next/
  page.jsx
  PmsNextApp.jsx
  core/
    navigation.js
    theme.js
  components/
    shell/
  features/
    dashboard/
    planning/
  pms-next.module.css
```

Cada módulo nuevo debe vivir dentro de `features/<modulo>` y exponer una superficie pequeña hacia el shell.

## Multi-tenant
La conexión a datos reales deberá cumplir:
1. `property_id` obligatorio en toda lectura/escritura hotelera.
2. Autorización del usuario contra la propiedad activa antes de ejecutar operaciones.
3. RLS en Supabase como última barrera, no sólo filtros del frontend.
4. Ningún dato de una propiedad debe persistir en caches compartidas sin clave de tenant.
5. Acciones sensibles deberán ejecutarse mediante servicios tipados, no consultas sueltas desde componentes.

## Rendimiento
- Carga por módulo y lazy loading donde corresponda.
- Virtualización del Planning cuando el volumen de habitaciones/fechas lo justifique.
- Evitar que una falla de Inbox, Reportes u otro módulo derribe el shell completo.
- Componentes pequeños; respetar los límites del architecture guard.
- Estados de carga, error y vacío por feature.

## Diseño
PMS Next usa una identidad propia de Habitación Llena: día/noche, superficies translúcidas, profundidad suave, interacción rápida y animaciones breves. Las referencias de otros PMS se utilizan para estudiar flujos y capacidades, no para copiar código ni identidad visual.

## Orden de implementación
1. Shell y sistema visual.
2. Planning completo.
3. Reserva / ficha de estadía.
4. Dashboard operativo.
5. Huéspedes e Inbox.
6. Housekeeping y mantenimiento.
7. Tarifas, pagos, reportes e integraciones.
8. Adaptador multi-tenant y migración progresiva a datos reales.

Producción sólo se reemplazará después de QA funcional, visual, responsive, seguridad multi-tenant y validación de performance.
