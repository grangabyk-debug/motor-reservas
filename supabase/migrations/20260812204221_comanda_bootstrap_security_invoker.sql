alter function public.comanda_bootstrap_account(text) security invoker;
revoke all on function public.comanda_bootstrap_account(text) from public,anon;
grant execute on function public.comanda_bootstrap_account(text) to authenticated;