-- Testy izolace tenantů (RLS). Běží v transakci, na konci rollback.
-- Spuštění: npm run db:test   (nebo scripts/test-db-local.sh bez Dockeru)
-- Předpoklad: aplikované migrace + seed (firma A = demo "Gastro U Lípy").
\set ON_ERROR_STOP 1
begin;

-- ---------------------------------------------------------------------------
-- Fixture: firma B s majitelem, zaměstnancem, šablonou, záznamem a menu
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'majitel@firma-b.cz', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'emp-b@employees.invalid', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-0000000000b3', 'novy@uzivatel.cz', 'authenticated', 'authenticated');
insert into public.companies (id, name) values ('cbbbbbbb-0000-4000-8000-000000000001', 'Bistro B');
insert into public.company_members (company_id, user_id, display_name)
  values ('cbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-0000000000b1', 'Majitel B');
insert into public.locations (id, company_id, name, public_slug)
  values ('1bbbbbbb-0000-4000-8000-000000000001', 'cbbbbbbb-0000-4000-8000-000000000001', 'Bistro B Praha', 'bistro-b');
insert into public.employees (id, company_id, location_id, user_id, name, pin_hash)
  values ('abbbbbbb-0000-4000-8000-000000000001', 'cbbbbbbb-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001',
          'bbbbbbbb-0000-4000-8000-0000000000b2', 'Karel B', extensions.crypt('9999', extensions.gen_salt('bf', 4)));
insert into public.task_templates (id, company_id, location_id, category, title, min_value, max_value)
  values ('bbbbbbbb-1111-4000-8000-000000000001', 'cbbbbbbb-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001',
          'temperature', 'Lednice B', 0, 5);
insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id)
  values ('bbbbbbbb-1111-4000-8000-000000000001', current_date, 'day', 3, 'bbbbbbbb-0000-4000-8000-0000000000b2');
insert into public.menu_items (company_id, location_id, name, allergens)
  values ('cbbbbbbb-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001', 'Burger B', '{1,3,7}');
insert into storage.objects (bucket_id, name)
  values ('task-photos', 'cbbbbbbb-0000-4000-8000-000000000001/1bbbbbbb-0000-4000-8000-000000000001/foto-b.jpg');

-- ===========================================================================
-- 1) Majitel A nevidí nic z firmy B
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean; n int;
begin
  assert (select count(*) from public.companies) = 1, 'owner A: vidí jen 1 firmu';
  assert (select name from public.companies) = 'Gastro U Lípy s.r.o.', 'owner A: vidí svoji firmu';
  assert not exists (select 1 from public.locations where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí provozovny B';
  assert not exists (select 1 from public.employees where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí zaměstnance B';
  assert not exists (select 1 from public.task_templates where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí šablony B';
  assert not exists (select 1 from public.task_records where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí záznamy B';
  assert not exists (select 1 from public.menu_items where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí menu B';
  assert not exists (select 1 from public.company_members where company_id = 'cbbbbbbb-0000-4000-8000-000000000001'), 'owner A: nevidí členy B';
  assert not exists (select 1 from storage.objects where name like 'cbbbbbbb%'), 'owner A: nevidí fotky B';
  assert (select count(*) from public.task_records) > 50, 'owner A: vidí vlastní záznamy';
  assert (select count(*) from public.employees) = 3, 'owner A: vidí 3 vlastní zaměstnance';

  -- zápis do firmy B musí selhat
  ok := false;
  begin
    insert into public.task_templates (company_id, location_id, category, title)
      values ('cbbbbbbb-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001', 'cleaning', 'hack');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: nesmí vložit šablonu do firmy B';

  ok := false;
  begin
    insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id)
      values ('bbbbbbbb-1111-4000-8000-000000000001', current_date, 'day', 3, auth.uid());
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: nesmí vložit záznam k šabloně firmy B';

  -- přesun vlastní šablony do provozovny B: buď RLS nebo FK chyba
  ok := false;
  begin
    update public.task_templates set location_id = '1bbbbbbb-0000-4000-8000-000000000001'
      where id = 'b0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege or foreign_key_violation then ok := true; end;
  assert ok, 'owner A: nesmí přesunout šablonu do provozovny B';

  ok := false;
  begin
    insert into public.employees (company_id, location_id, name)
      values ('c0000000-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001', 'Podvržený');
  exception when insufficient_privilege or foreign_key_violation then ok := true; end;
  assert ok, 'owner A: nesmí vložit zaměstnance do provozovny B přes vlastní company_id';

  update public.locations set name = 'hack' where id = '1bbbbbbb-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'owner A: nesmí upravit provozovnu B';

  delete from public.menu_items where company_id = 'cbbbbbbb-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'owner A: nesmí smazat menu B';

  ok := false;
  begin
    insert into storage.objects (bucket_id, name)
      values ('task-photos', 'cbbbbbbb-0000-4000-8000-000000000001/1bbbbbbb-0000-4000-8000-000000000001/x.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: nesmí nahrát fotku do složky firmy B';

  ok := false;
  begin
    insert into storage.objects (bucket_id, name)
      values ('task-photos', 'c0000000-0000-4000-8000-000000000001/1bbbbbbb-0000-4000-8000-000000000001/x.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: nesmí nahrát fotku s cizí provozovnou pod vlastní firmou';

  ok := false;
  begin
    perform public.set_employee_pin('abbbbbbb-0000-4000-8000-000000000001', '0000');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: nesmí změnit PIN zaměstnance B';

  -- hash PINu není čitelný ani pro majitele
  ok := false;
  begin
    perform pin_hash from public.employees limit 1;
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: pin_hash není čitelný';

  ok := false;
  begin
    perform public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '1111');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'verify_employee_pin smí volat jen service role';

  -- záznamy jsou neměnné
  ok := false;
  begin
    update public.task_records set value = 1 where company_id = 'c0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: záznamy nelze upravovat';
  ok := false;
  begin
    delete from public.task_records where company_id = 'c0000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'owner A: záznamy nelze mazat';
end $$;
reset role;

-- ===========================================================================
-- 2) Majitel B nevidí nic z firmy A
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.companies) = 1, 'owner B: 1 firma';
  assert (select count(*) from public.locations) = 1, 'owner B: 1 provozovna';
  assert (select count(*) from public.task_records) = 1, 'owner B: jen vlastní záznam';
  assert (select count(*) from public.menu_items) = 1, 'owner B: jen vlastní menu';
  assert (select count(*) from public.employees) = 1, 'owner B: jen vlastní zaměstnanec';
  assert not exists (select 1 from public.task_templates where company_id = 'c0000000-0000-4000-8000-000000000001'), 'owner B: nevidí šablony A';
  assert (select count(*) from storage.objects) = 1, 'owner B: vidí jen svoji fotku';
end $$;
reset role;

-- ===========================================================================
-- 3) Zaměstnanec A (Jana): jen svoje provozovna, nic z B, nic správcovského
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222201","role":"authenticated"}', true);
set local role authenticated;
do $$
declare ok boolean; v_id uuid; v_dev boolean; v_name text; n int;
begin
  assert (select count(*) from public.companies) = 1, 'emp A: vidí jen svoji firmu';
  assert (select count(*) from public.locations) = 1, 'emp A: vidí jen svoji provozovnu';
  assert (select count(*) from public.employees) = 1, 'emp A: vidí jen sám sebe';
  assert not exists (select 1 from public.task_templates where company_id <> 'c0000000-0000-4000-8000-000000000001'), 'emp A: nevidí šablony B';
  assert not exists (select 1 from public.task_records where company_id <> 'c0000000-0000-4000-8000-000000000001'), 'emp A: nevidí záznamy B';
  assert not exists (select 1 from public.task_records where task_date < current_date - 7), 'emp A: nevidí starou historii';
  assert not exists (select 1 from public.devices), 'emp A: nevidí zařízení';
  assert (select count(*) from public.company_members) = 0, 'emp A: nevidí členy firmy';

  -- vlastní záznam: teplota v limitu
  insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id)
    values ('b0000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Prague')::date, 'morning', 3.5, auth.uid())
    returning id, is_deviation, performer_name into v_id, v_dev, v_name;
  assert not v_dev, 'emp A: 3,5 °C není odchylka';
  assert v_name = 'Jana Nováková', 'emp A: jméno autora doplněno triggerem';

  -- teplota mimo limit bez nápravné akce → chyba
  ok := false;
  begin
    insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id)
      values ('b0000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Prague')::date, 'evening', 9, auth.uid());
  exception when check_violation then ok := true; end;
  assert ok, 'emp A: odchylka bez nápravné akce musí selhat';

  -- s nápravnou akcí projde a je označena; klient nemůže podvrhnout is_deviation
  insert into public.task_records (template_id, task_date, slot, value, corrective_action, is_deviation, performed_by_user_id)
    values ('b0000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Prague')::date, 'evening', 9,
            'Zboží přesunuto, servis objednán.', false, auth.uid())
    returning is_deviation into v_dev;
  assert v_dev, 'emp A: 9 °C je odchylka';

  -- nesmí podvrhnout autora: trigger vždy přepíše autora na přihlášeného uživatele
  insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id, performer_name)
    values ('b0000000-0000-4000-8000-000000000002', (now() at time zone 'Europe/Prague')::date, 'morning', 3,
            '22222222-2222-4222-8222-222222222202', 'Petr Svoboda')
    returning performed_by_user_id, performer_name into v_id, v_name;
  assert v_id = auth.uid() and v_name = 'Jana Nováková', 'emp A: nelze zapsat za kolegu';

  -- záznam k šabloně firmy B → zamítnuto
  ok := false;
  begin
    insert into public.task_records (template_id, task_date, slot, value, performed_by_user_id)
      values ('bbbbbbbb-1111-4000-8000-000000000001', current_date, 'day', 3, auth.uid());
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'emp A: nesmí zapsat do firmy B';

  -- zaměstnanec nesmí spravovat šablony, zaměstnance, menu
  ok := false;
  begin
    insert into public.task_templates (company_id, location_id, category, title)
      values ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'cleaning', 'x');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'emp A: nesmí vytvářet šablony';

  update public.task_templates set title = 'x';
  get diagnostics n = row_count;
  assert n = 0, 'emp A: nesmí upravit šablony';

  update public.employees set name = 'x';
  get diagnostics n = row_count;
  assert n = 0, 'emp A: nesmí upravit zaměstnance';

  ok := false;
  begin
    perform public.create_company('Moje firma');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'emp A: nesmí zakládat firmu';

  -- fotky: smí nahrát do své provozovny, ne do B
  insert into storage.objects (bucket_id, name)
    values ('task-photos', 'c0000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/foto.jpg');
  ok := false;
  begin
    insert into storage.objects (bucket_id, name)
      values ('task-photos', 'cbbbbbbb-0000-4000-8000-000000000001/1bbbbbbb-0000-4000-8000-000000000001/foto.jpg');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'emp A: nesmí nahrát fotku do B';
  assert not exists (select 1 from storage.objects where name like 'cbbbbbbb%'), 'emp A: nevidí fotky B';
end $$;
reset role;

-- ===========================================================================
-- 4) Zaměstnanec B nevidí nic z A
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  assert (select count(*) from public.task_templates) = 1, 'emp B: jen šablona B';
  assert not exists (select 1 from public.task_records where company_id = 'c0000000-0000-4000-8000-000000000001'), 'emp B: nevidí záznamy A';
  assert not exists (select 1 from public.menu_items where company_id = 'c0000000-0000-4000-8000-000000000001'), 'emp B: nevidí menu A';
  assert (select count(*) from public.companies) = 1, 'emp B: jen svoje firma';
end $$;
reset role;

-- ===========================================================================
-- 5) Nový uživatel bez firmy nevidí nic; po create_company vidí jen svoje
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v_cid uuid;
begin
  assert (select count(*) from public.companies) = 0, 'nový: žádná firma';
  assert (select count(*) from public.task_records) = 0, 'nový: žádné záznamy';
  v_cid := public.create_company('Kavárna C', '87654321', null, 'Eva');
  assert (select count(*) from public.companies) = 1, 'nový: vidí založenou firmu';
  insert into public.locations (company_id, name) values (v_cid, 'Kavárna C');
  assert (select count(*) from public.locations) = 1, 'nový: vidí svoji provozovnu';
end $$;
reset role;

-- ===========================================================================
-- 6) Anonym: tabulky nic, veřejné menu ano
-- ===========================================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare j jsonb;
begin
  assert (select count(*) from public.companies) = 0, 'anon: firmy';
  assert (select count(*) from public.task_records) = 0, 'anon: záznamy';
  assert (select count(*) from public.menu_items) = 0, 'anon: menu přímo ne';
  j := public.public_allergen_menu('u-lipy-brno');
  assert j->'location'->>'name' = 'Restaurace U Lípy', 'anon: veřejné menu A';
  assert jsonb_array_length(j->'items') = 8, 'anon: 8 jídel';
  assert public.public_allergen_menu('neexistuje') is null, 'anon: neznámý slug';
end $$;
reset role;

-- ===========================================================================
-- 7) Ověření PINu + zámek po 5 pokusech (service role)
-- ===========================================================================
set local role service_role;
do $$
begin
  assert public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '1111') = 'ok', 'pin ok';
  assert public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '1bbbbbbb-0000-4000-8000-000000000001', '1111') = 'invalid', 'pin: cizí provozovna';
  for i in 1..4 loop
    assert public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '0000') = 'invalid', 'pin špatně';
  end loop;
  assert public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '0000') = 'locked', 'pin: 5. pokus zamkne';
  assert public.verify_employee_pin('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '1111') = 'locked', 'pin: zamčeno i se správným';
end $$;
reset role;

-- ===========================================================================
-- 8) Seed: kontrola rozsahu vzorových dat
-- ===========================================================================
do $$
begin
  assert (select count(distinct task_date) from public.task_records where company_id = 'c0000000-0000-4000-8000-000000000001') >= 13, 'seed: 2 týdny';
  assert (select count(*) from public.task_records where company_id = 'c0000000-0000-4000-8000-000000000001' and is_deviation) > 0, 'seed: odchylky';
end $$;

\echo 'RLS izolace: všechny testy prošly'
rollback;
