-- Keep the guest portal's privileged conversation helper internal.
-- Public portal RPCs continue to validate the opaque stay token and call this helper as their function owner.
revoke all on function guest_portal_private.ensure_guest_portal_conversation(uuid,bigint) from public, anon, authenticated;
