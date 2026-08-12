# Comanda Llena v1

Comanda Llena comparte repositorio y proyecto de Vercel con Habitación Llena, pero mantiene frontera de código y datos propia.

## Rutas
- `/comanda`: landing pública del producto.
- `/comanda/registro`: alta de cuenta y prueba de 14 días.
- `/comanda/login`: acceso.
- `/comanda/onboarding`: configuración guiada.
- `/comanda/app`: operación gastronómica.

## Alcance funcional inicial
- sucursal y funcionarios
- salón, sectores y mesas
- editor drag-and-drop por grilla
- apertura de mesa con comensales y mozo
- carta por categorías y productos
- envío de comanda y monitor de cocina en Supabase Realtime
- estados pendiente, preparando, listo y entregado
- caja, apertura/cierre y movimientos
- pagos y bloqueo de cierre con saldo pendiente
- anulación con motivo y auditoría
- impresión inicial mediante impresión del navegador
- ayuda y soporte

## Seguridad
Todas las tablas gastronómicas usan prefijo `comanda_*` y RLS. `anon` no tiene grants sobre esas tablas. La pertenencia se resuelve con `comanda_accounts`/`comanda_members` y helpers privados. No se reutilizan tablas de habitaciones, reservas o pagos hoteleros.

## Pendientes posteriores a v1
- permisos configurables por puesto/terminal con enforcement más fino
- impresora térmica con bridge local
- facturación ARCA
- reservas de mesas
- división avanzada de cuenta y propinas
- stock/recetas/ingredientes
- integración real de `room_charge` con Habitación Llena
- reportes comerciales avanzados
- enrutamiento por `commandallena.com` cuando el dominio esté comprado y verificado
