-- Ukázková data: 1 restaurace, 1 majitel, 3 zaměstnanci, šablony úkolů,
-- 14 dní vzorových záznamů (vč. odchylek a nesplněných úkolů) a jídelní lístek s alergeny.
--
-- Přihlášení majitele:  majitel@demo.cz / demo1234
-- PINy zaměstnanců:     Jana 1111, Petr 2222, Lucie 3333

select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Uživatelé (auth.users + identities, aby fungovalo přihlášení e-mailem)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'majitel@demo.cz', extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"kind":"owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222201', 'authenticated', 'authenticated',
   'emp-a1000000-0000-4000-8000-000000000001@employees.invalid', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"kind":"employee"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222202', 'authenticated', 'authenticated',
   'emp-a1000000-0000-4000-8000-000000000002@employees.invalid', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"kind":"employee"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222203', 'authenticated', 'authenticated',
   'emp-a1000000-0000-4000-8000-000000000003@employees.invalid', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"kind":"employee"}', now(), now(), '', '', '', '');

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201',
               '22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222203');

-- ---------------------------------------------------------------------------
-- Firma, provozovna, zaměstnanci
-- ---------------------------------------------------------------------------
insert into public.companies (id, name, ico, address)
values ('c0000000-0000-4000-8000-000000000001', 'Gastro U Lípy s.r.o.', '12345678', 'Lipová 12, 602 00 Brno');

insert into public.company_members (company_id, user_id, role, display_name)
values ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'owner', 'Martin Lipový');

insert into public.locations (id, company_id, name, address, public_slug)
values ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
        'Restaurace U Lípy', 'Lipová 12, 602 00 Brno', 'u-lipy-brno');

insert into public.employees (id, company_id, location_id, user_id, name, pin_hash) values
  ('a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222201', 'Jana Nováková', extensions.crypt('1111', extensions.gen_salt('bf', 8))),
  ('a1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222202', 'Petr Svoboda', extensions.crypt('2222', extensions.gen_salt('bf', 8))),
  ('a1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222203', 'Lucie Dvořáková', extensions.crypt('3333', extensions.gen_salt('bf', 8)));

-- ---------------------------------------------------------------------------
-- Šablony úkolů
-- ---------------------------------------------------------------------------
insert into public.task_templates
  (id, company_id, location_id, category, title, instructions, frequency, due_time, evening_due_time, weekday,
   min_value, max_value, repeatable, sort_order)
values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'temperature', 'Lednice 1 – kuchyň', 'Odečti teplotu z teploměru uvnitř lednice.', 'morning_evening', '09:00', '21:00', null, 0, 5, false, 10),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'temperature', 'Lednice 2 – bar', 'Odečti teplotu z teploměru uvnitř lednice.', 'morning_evening', '09:00', '21:00', null, 0, 5, false, 20),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'temperature', 'Mrazák', 'Teplota musí být −18 °C nebo nižší.', 'morning_evening', '09:00', '21:00', null, null, -18, false, 30),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'temperature', 'Výdej teplých jídel', 'Změř vpichovým teploměrem jádro pokrmu ve výdejním pultu (min. 60 °C).', 'daily', '12:30', '21:00', null, 60, null, false, 40),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'cleaning', 'Úklid a dezinfekce pracovních ploch', 'Mycí prostředek, oplach, dezinfekce dle sanitačního plánu.', 'daily', '22:00', '21:00', null, null, null, false, 50),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'cleaning', 'Sanitace kuchyně – generální', 'Lednice, police, digestoř, podlahy, odpady.', 'weekly', '22:00', '21:00', 1, null, null, false, 60),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'goods_receipt', 'Příjem zboží', 'Zkontroluj teplotu chlazeného zboží a neporušenost obalů.', 'daily', '11:00', '21:00', null, 0, 5, true, 70),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'expiry', 'Kontrola trvanlivosti potravin', 'Projdi lednice a sklad, vyřaď potraviny po datu použitelnosti.', 'daily', '10:00', '21:00', null, null, null, false, 80);

-- šablony existují už měsíc (jinak by se minulé nesplněné úkoly nepočítaly)
update public.task_templates set created_at = now() - interval '30 days'
 where location_id = '10000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 14 dní záznamů
-- ---------------------------------------------------------------------------
do $$
declare
  v_tz      text := 'Europe/Prague';
  v_today   date := (now() at time zone 'Europe/Prague')::date;
  v_now_loc timestamp := now() at time zone 'Europe/Prague';
  d         date;
  t         record;
  s         record;
  emp_ids   uuid[] := array['a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003']::uuid[];
  emp_uids  uuid[] := array['22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222202','22222222-2222-4222-8222-222222222203']::uuid[];
  suppliers text[] := array['Makro Cash & Carry','Bidfood','Masna Prostějov','Pekárna Bánov','Mlékárna Valašské Meziříčí'];
  products  text[] := array['kuřecí prsa','vepřová plec','mléko a smetana','pečivo','zelenina','sýry'];
  fixes_cold text[] := array['Přeskládáno zboží, dveře dovřeny, kontrola za 30 min: 4,1 °C.',
                             'Termostat snížen, zboží přesunuto do lednice 2.',
                             'Odmrazen výparník, přivolán servis, citlivé zboží vyřazeno.'];
  i int;
  v_due timestamp;
  v_val numeric;
  v_dev boolean;
  v_fix text;
  v_details jsonb;
begin
  for d in select generate_series(v_today - 13, v_today, interval '1 day')::date loop
    for t in select * from public.task_templates where location_id = '10000000-0000-4000-8000-000000000001' loop
      for s in
        select * from (values ('morning', t.due_time), ('evening', t.evening_due_time)) x(slot, due)
          where t.frequency = 'morning_evening'
        union all select 'day', t.due_time where t.frequency = 'daily'
        union all select 'week', t.due_time where t.frequency = 'weekly' and extract(isodow from d) = t.weekday
      loop
        v_due := d + s.due;
        -- dnes jen úkoly, jejichž termín už minul
        if d = v_today and v_due > v_now_loc then continue; end if;
        -- ~4 % úkolů nesplněno (kromě příjmu zboží, který je nepravidelný)
        if t.category <> 'goods_receipt' and random() < 0.04 then continue; end if;

        i := 1 + floor(random() * 3)::int;
        v_dev := false; v_fix := null; v_val := null; v_details := '{}'::jsonb;

        if t.category = 'temperature' then
          if t.max_value = -18 and t.min_value is null then
            v_val := round((-22 + random() * 3)::numeric, 1);
            if random() < 0.10 then v_val := -15.5; v_fix := 'Mrazák byl přeplněný, dveře nedovřené. Zboží zkontrolováno, kontrola za hodinu −19 °C.'; end if;
          elsif t.min_value = 60 then
            v_val := round((63 + random() * 12)::numeric, 1);
            if random() < 0.10 then v_val := 56.0; v_fix := 'Pokrm ohřát na 75 °C v jádře, výdejní vana zapnuta na vyšší stupeň.'; end if;
          else
            v_val := round((1.5 + random() * 3)::numeric, 1);
            if random() < 0.10 then v_val := round((6 + random() * 2)::numeric, 1); v_fix := fixes_cold[1 + floor(random() * 3)::int]; end if;
          end if;
        elsif t.category = 'goods_receipt' then
          -- příjem jen v pracovní dny, 1–2 dodávky
          if extract(isodow from d) > 5 then continue; end if;
          for n in 1 .. (1 + floor(random() * 2)::int) loop
            v_val := round((1 + random() * 3.5)::numeric, 1);
            v_details := jsonb_build_object('supplier', suppliers[1 + floor(random() * 5)::int],
                                            'product', products[1 + floor(random() * 6)::int],
                                            'temperature', v_val, 'package_ok', true);
            v_fix := null;
            if random() < 0.15 then
              v_details := v_details || '{"package_ok": false}';
              v_fix := 'Poškozený obal – zboží vráceno dodavateli, sepsán reklamační protokol.';
            end if;
            insert into public.task_records (template_id, task_date, slot, value, details, corrective_action,
                                             performed_by_user_id, performed_at, note)
            values (t.id, d, s.slot, v_val, v_details, v_fix, emp_uids[i],
                    ((d + s.due - make_interval(mins => (random() * 120)::int)) at time zone v_tz), null);
          end loop;
          continue;
        elsif t.category = 'expiry' then
          v_details := '{"ok": true}';
          if random() < 0.15 then
            v_details := '{"ok": false}';
            v_fix := 'Vyřazeny 2 ks jogurtu a 1 balení šunky po datu použitelnosti, zapsáno do odpadů.';
          end if;
        end if;

        insert into public.task_records (template_id, task_date, slot, value, details, corrective_action,
                                         performed_by_user_id, performed_at)
        values (t.id, d, s.slot, v_val, v_details, v_fix, emp_uids[i],
                ((d + s.due - make_interval(mins => (random() * 50)::int)) at time zone v_tz));
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Jídelní lístek s alergeny (čísla dle nařízení EU 1169/2011)
-- ---------------------------------------------------------------------------
insert into public.menu_items (company_id, location_id, category, name, description, price, allergens, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Polévky', 'Hovězí vývar s nudlemi', 'kořenová zelenina, domácí nudle', 69, '{1,3,9}', 10),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Polévky', 'Česnečka se sýrem a krutony', null, 65, '{1,7}', 20),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Hlavní jídla', 'Svíčková na smetaně, houskový knedlík', 'brusinky, šlehačka', 219, '{1,3,7,9,10}', 30),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Hlavní jídla', 'Smažený sýr, hranolky, tatarská omáčka', null, 189, '{1,3,7,10}', 40),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Hlavní jídla', 'Pečený losos, bylinkové brambory', 'citronové máslo', 289, '{4,7}', 50),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Hlavní jídla', 'Kuřecí satay s arašídovou omáčkou, jasmínová rýže', null, 229, '{5,6,11}', 60),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Dezerty', 'Jablečný štrúdl se šlehačkou', 'vlašské ořechy, rozinky', 95, '{1,3,7,8}', 70),
  ('c0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Saláty', 'Caesar salát s krevetami', 'parmazán, ančovičkový dresink', 249, '{1,2,3,4,7,10}', 80);
