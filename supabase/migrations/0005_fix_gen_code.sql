-- Fix: the local variable `code` in app.gen_code collided with games.code in the
-- uniqueness check ("column reference code is ambiguous"). Rename to v_code.
-- (CREATE OR REPLACE resets function attributes, so re-pin search_path.)
create or replace function app.gen_code()
returns text language plpgsql set search_path = '' as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games g where g.code = v_code);
  end loop;
  return v_code;
end;
$$;
