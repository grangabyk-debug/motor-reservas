# Habitación Llena — Runbook de releases y actualizaciones

## Principio

Una actualización no se publica directamente sobre hoteles reales. La misma versión debe atravesar preview, QA y staging con evidencia de que código, migraciones y aislamiento multi-tenant son compatibles.

## Flujo normal

1. Crear cambio en rama de trabajo.
2. Vercel genera Preview Deployment.
3. Ejecutar build, lint y pruebas automáticas.
4. Ejecutar pruebas multi-tenant con al menos dos propiedades.
5. Si hay migración, aplicarla primero en entorno no productivo y correr smoke tests.
6. Promover el cambio a staging.
7. QA funcional de los recorridos afectados.
8. Revisar Security/Performance Advisor cuando la release toca base, auth o RLS.
9. Aprobar release.
10. Promover aplicación/migraciones de forma compatible a producción.
11. Ejecutar smoke tests de producción.
12. Observar errores, latencia y procesos críticos.

## Nunca hacer

- editar schema productivo manualmente como rutina;
- mergear automáticamente una release importante sin QA;
- cambiar una policy/RPC sensible sin probar acceso entre tenants;
- hacer `DROP`, rename destructivo o cambio de tipo incompatible junto con el primer frontend que lo necesita;
- guardar secretos en variables `NEXT_PUBLIC_*`;
- crear una rama distinta del producto para cada hotel;
- usar datos reales de otro hotel para probar un tenant;
- desplegar un botón que confirma éxito sin persistencia real.

## Rollout de funciones nuevas

Para funciones de riesgo medio/alto:

1. Flag apagado globalmente.
2. Activar para tenant interno/demo controlado.
3. Activar para hoteles piloto elegidos.
4. Monitorear errores/feedback.
5. Ampliar rollout gradualmente.
6. Activar general.
7. Retirar el flag cuando la función sea estable.

## Emergencia de aplicación

Si una release rompe un flujo crítico y la base sigue siendo backward-compatible:

- detener rollout;
- volver al deployment anterior conocido como bueno;
- verificar login, Planning, creación de reserva, check-in/out y pagos;
- abrir incidente con SHA, deployment y horario;
- reparar en rama nueva y volver a recorrer el flujo de release.

## Emergencia de base de datos

No improvisar rollback SQL destructivo.

- identificar migración exacta;
- evaluar si la app anterior sigue siendo compatible;
- preferir migración correctiva forward;
- restaurar desde PITR sólo cuando el incidente lo requiera y con procedimiento aprobado;
- validar integridad por `property_id` después de cualquier recuperación.

## Smoke test mínimo por release

- login y selección de propiedad;
- usuario sin acceso no ve propiedad ajena;
- Dashboard carga datos del tenant correcto;
- Planning carga habitaciones/reservas del tenant correcto;
- crear reserva;
- mover reserva en Planning;
- impedir solapamiento/conflicto;
- abrir ficha de huésped;
- registrar/cargar pagos según permisos;
- check-in;
- check-out;
- housekeeping;
- mantenimiento;
- tarifas/disponibilidad;
- informes;
- cambio de propiedad para usuarios multi-property;
- logout/login.

## Release record

Guardar por release:

- versión;
- commit SHA;
- deployment ID;
- migraciones incluidas;
- feature flags modificados;
- responsable de aprobación;
- fecha/hora;
- resultado de smoke test;
- rollback candidate.

## Actualizaciones para los hoteles

Habitación Llena es SaaS: el cliente no descarga instaladores. La aplicación web se actualiza centralmente. Los cambios incompatibles se evitan con migraciones backward-compatible y feature flags. Una sesión abierta puede continuar con la versión cargada hasta recargar; para releases que requieran refresco se debe mostrar un aviso no destructivo del tipo “Hay una actualización disponible”, nunca recargar en medio de una edición/reserva sin consentimiento o checkpoint seguro.
