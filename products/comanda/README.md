# Comanda Llena

Comanda Llena vive dentro del mismo repositorio y proyecto de Vercel que Habitación Llena, pero se desarrolla como un producto aislado.

## Regla principal

Todo el código específico de restaurante debe vivir dentro de `products/comanda/` o en la entrada web `app/comanda/`.

Comanda Llena NO debe importar lógica interna de:

- `app/dashboard/`
- `app/hosteria-durazno/`
- módulos hoteleros que se creen en el futuro

Si una capacidad sirve a ambos productos (autenticación, permisos, facturación, impresión, componentes visuales, etc.), primero se extrae a un módulo compartido neutral y recién después ambos productos lo consumen.

## Datos

Cuando se agregue persistencia para Comanda Llena, las tablas y políticas deben usar un namespace propio (`comanda_*` o un schema dedicado), con RLS y tenant_id independientes. No se deben reutilizar tablas hoteleras para guardar mesas, comandas, reservas de restaurante, caja o stock gastronómico.

## Dominio

El dominio `commandallena.com` se conectará al mismo proyecto de Vercel más adelante. El enrutamiento por hostname se habilitará recién cuando el dominio esté comprado y verificado, para no tocar innecesariamente el tráfico actual de Habitación Llena.
