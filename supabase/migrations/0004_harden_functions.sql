-- Xor0 multiplayer — security hardening for the function layer.
--
-- 1) Pin search_path on the app.* helpers (advisor lint 0011). Every reference
--    inside them is schema-qualified or lives in pg_catalog, so an empty path is safe.
-- 2) Revoke the implicit PUBLIC/anon EXECUTE on the RPCs so only signed-in
--    (authenticated) users can call them (advisor lint 0028). The RPCs already
--    reject null auth.uid(), this just removes the surface.

alter function app.popcount(int)          set search_path = '';
alter function app.xor(int[])             set search_path = '';
alter function app.dots(int[])            set search_path = '';
alter function app.difficulty_mask(text)  set search_path = '';
alter function app.table_size(text)       set search_path = '';
alter function app.has_group(int[])       set search_path = '';
alter function app.gen_code()             set search_path = '';
alter function app.deal(text)             set search_path = '';

revoke execute on function public.create_game(text, text)   from anon, public;
revoke execute on function public.join_game(text)            from anon, public;
revoke execute on function public.join_quick_match(text)     from anon, public;
revoke execute on function public.start_game(uuid)           from anon, public;
revoke execute on function public.leave_game(uuid)           from anon, public;
revoke execute on function public.claim_group(uuid, int[])   from anon, public;
