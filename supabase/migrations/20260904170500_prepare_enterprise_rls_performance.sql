-- Habitación Llena — hardening RLS/performance (backward-compatible)
-- Aplicar primero en preview/staging. No cambia el modelo funcional de permisos.

begin;

-- profiles_select_access ya contempla el propio perfil mediante
-- private.user_can_view_profile(id), por lo que esta policy SELECT adicional
-- sólo duplica evaluación para usuarios autenticados.
drop policy if exists "Users can view own profile" on public.profiles;

-- Misma regla de UPDATE, evitando reevaluar auth.uid() por cada fila.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Mantener semántica exacta de membership para integraciones/inbox,
-- pero calcular auth.uid() una sola vez por statement.
drop policy if exists integration_connections_select_member on public.integration_connections;
create policy integration_connections_select_member
on public.integration_connections
for select
to authenticated
using (
  exists (
    select 1 from public.property_members pm
    where pm.property_id = integration_connections.property_id
      and pm.user_id = (select auth.uid())
  )
);

drop policy if exists inbox_conversations_select_member on public.inbox_conversations;
create policy inbox_conversations_select_member
on public.inbox_conversations
for select
to authenticated
using (
  exists (
    select 1 from public.property_members pm
    where pm.property_id = inbox_conversations.property_id
      and pm.user_id = (select auth.uid())
  )
);

drop policy if exists inbox_conversations_update_member on public.inbox_conversations;
create policy inbox_conversations_update_member
on public.inbox_conversations
for update
to authenticated
using (
  exists (
    select 1 from public.property_members pm
    where pm.property_id = inbox_conversations.property_id
      and pm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.property_members pm
    where pm.property_id = inbox_conversations.property_id
      and pm.user_id = (select auth.uid())
  )
);

drop policy if exists inbox_messages_select_member on public.inbox_messages;
create policy inbox_messages_select_member
on public.inbox_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.inbox_conversations c
    join public.property_members pm on pm.property_id = c.property_id
    where c.id = inbox_messages.conversation_id
      and pm.user_id = (select auth.uid())
  )
);

-- Advisor detectó pares idénticos. Conservar un solo índice de cada par.
drop index if exists public.idx_integration_connections_property_id;
drop index if exists public.idx_reservations_property_id;

commit;
