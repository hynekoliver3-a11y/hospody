-- HACCP deník – základní schéma, RLS a RPC funkce.
-- Konvence:
--   * každý řádek nese company_id (a kde dává smysl location_id) → tenant izolace přes RLS
--   * pomocné funkce pro RLS jsou v schématu "private" (není vystavené přes PostgREST)
--   * záznamy úkolů (task_records) jsou neměnné – auditní stopa pro kontrolu hygieny

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Typy
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner');            -- později: 'manager'
create type public.task_category as enum ('temperature', 'cleaning', 'goods_receipt', 'expiry', 'other');
create type public.task_frequency as enum ('daily', 'morning_evening', 'weekly');

-- ---------------------------------------------------------------------------
-- Firmy, provozovny, členství
-- ---------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 200),
  ico         text check (ico is null or ico ~ '^\d{8}$'),
  address     text,
  locale      text not null default 'cs',
  -- Stripe (mimo MVP): stripe_customer_id se doplní při zavedení předplatného
  stripe_customer_id text,
  created_at  timestamptz not null default now()
);

create table public.company_members (
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.member_role not null default 'owner',
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index on public.company_members (user_id);

create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 200),
  address      text,
  timezone     text not null default 'Europe/Prague',
  -- veřejný identifikátor pro stránku s alergeny (QR kód)
  public_slug  text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  -- kam posílat upozornění; null = e-maily všech majitelů firmy
  alert_email  text,
  -- Stripe (mimo MVP): předplatné se bude účtovat za provozovnu
  subscription_status text not null default 'trial',
  created_at   timestamptz not null default now(),
  unique (id, company_id)
);
create index on public.locations (company_id);

-- ---------------------------------------------------------------------------
-- Zaměstnanci (bez e-mailu, přihlášení PINem na tabletu provozovny)
-- Každý zaměstnanec má technický auth.users účet (syntetický e-mail),
-- takže RLS funguje jednotně přes auth.uid().
-- ---------------------------------------------------------------------------
create table public.employees (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  location_id         uuid not null,
  user_id             uuid unique references auth.users(id) on delete set null,
  name                text not null check (length(trim(name)) between 1 and 100),
  pin_hash            text,
  active              boolean not null default true,
  failed_pin_attempts int not null default 0,
  locked_until        timestamptz,
  created_at          timestamptz not null default now(),
  foreign key (location_id, company_id) references public.locations(id, company_id) on delete cascade
);
create index on public.employees (location_id);

-- Spárované tablety (zařízení) provozovny. Token je jen v httpOnly cookie tabletu.
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  location_id  uuid not null,
  name         text not null default 'Tablet',
  token_hash   text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  foreign key (location_id, company_id) references public.locations(id, company_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Šablony úkolů a záznamy
-- ---------------------------------------------------------------------------
create table public.task_templates (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  location_id      uuid not null,
  category         public.task_category not null,
  title            text not null check (length(trim(title)) between 1 and 200),
  instructions     text,
  frequency        public.task_frequency not null default 'daily',
  due_time         time not null default '12:00',   -- denně / ráno / týdně
  evening_due_time time not null default '21:00',   -- jen pro morning_evening
  weekday          smallint check (weekday between 1 and 7), -- ISO: 1 = pondělí, jen pro weekly
  min_value        numeric(6,2),
  max_value        numeric(6,2),
  unit             text not null default '°C',
  photo_required   boolean not null default false,
  repeatable       boolean not null default false,  -- např. příjem zboží: víc záznamů za den
  active           boolean not null default true,
  sort_order       int not null default 0,
  -- budoucí bezdrátová čidla: vazba šablony na senzor
  sensor_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (location_id, company_id) references public.locations(id, company_id) on delete cascade,
  check (category <> 'temperature' or min_value is not null or max_value is not null),
  check (min_value is null or max_value is null or min_value <= max_value),
  check (frequency <> 'weekly' or weekday is not null)
);
create index on public.task_templates (location_id) where active;

create table public.task_records (
  -- id generuje klient (offline fronta) → idempotentní odeslání
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  location_id              uuid not null,
  template_id              uuid not null references public.task_templates(id) on delete restrict,
  task_date                date not null,
  slot                     text not null check (slot in ('day', 'morning', 'evening', 'week')),
  -- snapshot šablony v okamžiku záznamu (šablona se může později změnit)
  title                    text not null,
  category                 public.task_category not null,
  min_value                numeric(6,2),
  max_value                numeric(6,2),
  unit                     text,
  value                    numeric(6,2),
  details                  jsonb not null default '{}'::jsonb,
  is_deviation             boolean not null default false,
  corrective_action        text,
  note                     text,
  photo_path               text,
  performed_by_user_id     uuid not null references auth.users(id) on delete restrict,
  performed_by_employee_id uuid references public.employees(id) on delete set null,
  performer_name           text not null,
  performed_at             timestamptz not null default now(),
  -- zdroj záznamu: 'app' | 'offline' | později 'sensor'
  source                   text not null default 'app',
  created_at               timestamptz not null default now(),
  foreign key (location_id, company_id) references public.locations(id, company_id) on delete cascade,
  check (not is_deviation or length(trim(coalesce(corrective_action, ''))) > 0)
);
create index on public.task_records (location_id, task_date);
create index on public.task_records (company_id, task_date) where is_deviation;

-- ---------------------------------------------------------------------------
-- Alergeny / jídelní lístek
-- ---------------------------------------------------------------------------
create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  location_id uuid not null,
  name        text not null check (length(trim(name)) between 1 and 200),
  description text,
  category    text,
  price       numeric(10,2),
  allergens   smallint[] not null default '{}'
              check (allergens <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14]::smallint[]),
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (location_id, company_id) references public.locations(id, company_id) on delete cascade
);
create index on public.menu_items (location_id);

-- ---------------------------------------------------------------------------
-- Log odeslaných upozornění (deduplikace cronu). Jen service role.
-- ---------------------------------------------------------------------------
create table public.alert_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  kind        text not null check (kind in ('overdue', 'deviation')),
  ref_key     text not null unique,
  sent_at     timestamptz not null default now()
);

-- ===========================================================================
-- Pomocné funkce pro RLS (security definer → nevolají RLS rekurzivně)
-- ===========================================================================
create or replace function private.is_company_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function private.my_employee_location_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.location_id from public.employees e
  where e.user_id = auth.uid() and e.active
  limit 1;
$$;

create or replace function private.my_employee_company_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.company_id from public.employees e
  where e.user_id = auth.uid() and e.active
  limit 1;
$$;

create or replace function private.can_access_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.locations l
    join public.company_members m on m.company_id = l.company_id
    where l.id = p_location_id and m.user_id = auth.uid() and m.role = 'owner'
  ) or p_location_id = private.my_employee_location_id();
$$;

create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

grant execute on all functions in schema private to authenticated, anon, service_role;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.locations       enable row level security;
alter table public.employees       enable row level security;
alter table public.devices         enable row level security;
alter table public.task_templates  enable row level security;
alter table public.task_records    enable row level security;
alter table public.menu_items      enable row level security;
alter table public.alert_log       enable row level security;

-- companies
create policy companies_select on public.companies for select to authenticated
  using (private.is_company_owner(id) or id = private.my_employee_company_id());
create policy companies_update on public.companies for update to authenticated
  using (private.is_company_owner(id)) with check (private.is_company_owner(id));
-- insert jen přes RPC create_company()

-- company_members
create policy members_select on public.company_members for select to authenticated
  using (user_id = auth.uid() or private.is_company_owner(company_id));
create policy members_update_self on public.company_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- locations
create policy locations_select on public.locations for select to authenticated
  using (private.is_company_owner(company_id) or id = private.my_employee_location_id());
create policy locations_insert on public.locations for insert to authenticated
  with check (private.is_company_owner(company_id));
create policy locations_update on public.locations for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));
create policy locations_delete on public.locations for delete to authenticated
  using (private.is_company_owner(company_id));

-- employees (pin_hash a lockout sloupce nejsou čitelné – viz column grants níže)
create policy employees_select on public.employees for select to authenticated
  using (private.is_company_owner(company_id) or user_id = auth.uid());
create policy employees_insert on public.employees for insert to authenticated
  with check (private.is_company_owner(company_id));
create policy employees_update on public.employees for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));
create policy employees_delete on public.employees for delete to authenticated
  using (private.is_company_owner(company_id));

-- devices
create policy devices_select on public.devices for select to authenticated
  using (private.is_company_owner(company_id));
create policy devices_update on public.devices for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));
create policy devices_delete on public.devices for delete to authenticated
  using (private.is_company_owner(company_id));

-- task_templates
create policy templates_select on public.task_templates for select to authenticated
  using (private.is_company_owner(company_id)
         or (active and location_id = private.my_employee_location_id()));
create policy templates_insert on public.task_templates for insert to authenticated
  with check (private.is_company_owner(company_id));
create policy templates_update on public.task_templates for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));
create policy templates_delete on public.task_templates for delete to authenticated
  using (private.is_company_owner(company_id));

-- task_records: číst může majitel (vše) a zaměstnanec (svoje provozovna, posledních pár dní);
-- vkládat kdokoli s přístupem k provozovně; upravovat/mazat nikdo (auditní stopa).
create policy records_select on public.task_records for select to authenticated
  using (private.is_company_owner(company_id)
         or (location_id = private.my_employee_location_id() and task_date >= current_date - 7));
create policy records_insert on public.task_records for insert to authenticated
  with check (private.can_access_location(location_id) and performed_by_user_id = auth.uid());

-- menu_items
create policy menu_select on public.menu_items for select to authenticated
  using (private.is_company_owner(company_id) or location_id = private.my_employee_location_id());
create policy menu_insert on public.menu_items for insert to authenticated
  with check (private.is_company_owner(company_id));
create policy menu_update on public.menu_items for update to authenticated
  using (private.is_company_owner(company_id)) with check (private.is_company_owner(company_id));
create policy menu_delete on public.menu_items for delete to authenticated
  using (private.is_company_owner(company_id));

-- alert_log: žádné policy → přístup jen service role

-- Sloupcová práva: zaměstnanci/majitelé nesmí číst hash PINu ani stav zámku.
revoke select on public.employees from anon, authenticated;
revoke insert on public.employees from anon, authenticated;
grant insert (company_id, location_id, name, active) on public.employees to authenticated;
grant select (id, company_id, location_id, user_id, name, active, created_at)
  on public.employees to authenticated;
revoke update on public.employees from anon, authenticated;
grant update (name, active, location_id) on public.employees to authenticated;

-- devices: token_hash nečitelný
revoke select on public.devices from anon, authenticated;
grant select (id, company_id, location_id, name, created_at, last_seen_at, revoked_at)
  on public.devices to authenticated;

-- task_records: klient nesmí podvrhnout odvozené sloupce (doplní je trigger)
revoke update, delete on public.task_records from anon, authenticated;

-- ===========================================================================
-- Triggery
-- ===========================================================================
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger task_templates_touch before update on public.task_templates
  for each row execute function private.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function private.touch_updated_at();

-- Zaměstnanec musí patřit provozovně stejné firmy (zajišťuje i FK), šablona taky.
-- Záznam úkolu: doplní snapshot šablony, provozovnu, autora, vyhodnotí odchylku.
create or replace function private.task_records_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t   public.task_templates%rowtype;
  emp public.employees%rowtype;
  v_uid uuid := coalesce(auth.uid(), new.performed_by_user_id);
  v_temp numeric;
  v_today date;
begin
  select * into t from public.task_templates where id = new.template_id;
  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  new.company_id  := t.company_id;
  new.location_id := t.location_id;
  new.title       := t.title;
  new.category    := t.category;
  new.min_value   := t.min_value;
  new.max_value   := t.max_value;
  new.unit        := t.unit;

  if v_uid is null then
    raise exception 'performer_required' using errcode = '42501';
  end if;
  new.performed_by_user_id := v_uid;

  select * into emp from public.employees where user_id = v_uid;
  if found then
    if not emp.active then
      raise exception 'employee_inactive' using errcode = '42501';
    end if;
    new.performed_by_employee_id := emp.id;
    new.performer_name := emp.name;
  else
    new.performed_by_employee_id := null;
    select coalesce(nullif(m.display_name, ''), 'Majitel') into new.performer_name
      from public.company_members m
      where m.user_id = v_uid and m.company_id = t.company_id;
    if new.performer_name is null then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;

  -- datum úkolu: nejvýš 7 dní zpět (offline fronta), ne do budoucna
  if auth.uid() is not null then
    select (now() at time zone l.timezone)::date into v_today
      from public.locations l where l.id = t.location_id;
    if new.task_date > v_today or new.task_date < v_today - 7 then
      raise exception 'task_date_out_of_range' using errcode = '22023';
    end if;
    if new.performed_at > now() + interval '5 minutes' then
      new.performed_at := now();
    end if;
  end if;

  -- vyhodnocení odchylky
  new.is_deviation := false;
  if t.category = 'temperature' then
    if new.value is null then
      raise exception 'value_required' using errcode = '23502';
    end if;
    new.is_deviation := (t.min_value is not null and new.value < t.min_value)
                     or (t.max_value is not null and new.value > t.max_value);
  elsif t.category = 'goods_receipt' then
    v_temp := nullif(new.details->>'temperature', '')::numeric;
    if v_temp is not null then
      new.value := v_temp;
    end if;
    new.is_deviation := (v_temp is not null and t.min_value is not null and v_temp < t.min_value)
                     or (v_temp is not null and t.max_value is not null and v_temp > t.max_value)
                     or coalesce((new.details->>'package_ok')::boolean, true) = false;
  elsif t.category = 'expiry' then
    new.is_deviation := coalesce((new.details->>'ok')::boolean, true) = false;
  end if;

  if new.is_deviation and length(trim(coalesce(new.corrective_action, ''))) = 0 then
    raise exception 'corrective_action_required' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger task_records_before_insert before insert on public.task_records
  for each row execute function private.task_records_before_insert();

-- ===========================================================================
-- RPC
-- ===========================================================================

-- Založení firmy přihlášeným majitelem (po registraci).
create or replace function public.create_company(
  p_name text, p_ico text default null, p_address text default null, p_display_name text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.employees where user_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.companies (name, ico, address)
    values (p_name, nullif(trim(p_ico), ''), p_address)
    returning id into v_company_id;
  insert into public.company_members (company_id, user_id, role, display_name)
    values (v_company_id, auth.uid(), 'owner', coalesce(p_display_name, ''));
  return v_company_id;
end;
$$;
revoke execute on function public.create_company from public, anon;
grant execute on function public.create_company to authenticated;

-- Nastavení PINu zaměstnance (majitel). PIN se ukládá jen jako bcrypt hash.
create or replace function public.set_employee_pin(p_employee_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.employees where id = p_employee_id;
  if v_company is null or not private.is_company_owner(v_company) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'invalid_pin' using errcode = '22023';
  end if;
  update public.employees
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
         failed_pin_attempts = 0, locked_until = null
   where id = p_employee_id;
end;
$$;
revoke execute on function public.set_employee_pin from public, anon;
grant execute on function public.set_employee_pin to authenticated;

-- Ověření PINu – volá jen server (service role) po ověření tokenu tabletu.
-- 5 chybných pokusů → zámek na 5 minut.
create or replace function public.verify_employee_pin(p_employee_id uuid, p_location_id uuid, p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.employees%rowtype;
begin
  select * into e from public.employees
   where id = p_employee_id and location_id = p_location_id and active
   for update;
  if not found or e.pin_hash is null then
    return 'invalid';
  end if;
  if e.locked_until is not null and e.locked_until > now() then
    return 'locked';
  end if;
  if e.pin_hash = extensions.crypt(p_pin, e.pin_hash) then
    update public.employees set failed_pin_attempts = 0, locked_until = null where id = e.id;
    return 'ok';
  end if;
  update public.employees
     set failed_pin_attempts = case when e.failed_pin_attempts + 1 >= 5 then 0 else e.failed_pin_attempts + 1 end,
         locked_until = case when e.failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
   where id = e.id;
  return case when e.failed_pin_attempts + 1 >= 5 then 'locked' else 'invalid' end;
end;
$$;
revoke execute on function public.verify_employee_pin from public, anon, authenticated;
grant execute on function public.verify_employee_pin to service_role;

-- Veřejný jídelní lístek s alergeny (QR stránka) – bez přihlášení.
create or replace function public.public_allergen_menu(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'location', jsonb_build_object('name', l.name, 'address', l.address),
    'company',  jsonb_build_object('name', c.name),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', mi.name, 'description', mi.description, 'category', mi.category,
               'price', mi.price, 'allergens', mi.allergens)
             order by mi.category nulls last, mi.sort_order, mi.name)
      from public.menu_items mi where mi.location_id = l.id and mi.active
    ), '[]'::jsonb)
  )
  from public.locations l join public.companies c on c.id = l.company_id
  where l.public_slug = p_slug;
$$;
grant execute on function public.public_allergen_menu to anon, authenticated;

-- ===========================================================================
-- Storage: fotky k záznamům. Cesta: {company_id}/{location_id}/{soubor}
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

create policy task_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-photos'
    and private.can_access_location(private.try_uuid((storage.foldername(objects.name))[2]))
    and exists (
      select 1 from public.locations l
      where l.id = private.try_uuid((storage.foldername(objects.name))[2])
        and l.company_id = private.try_uuid((storage.foldername(objects.name))[1])
    )
  );

create policy task_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'task-photos'
    and (
      private.is_company_owner(private.try_uuid((storage.foldername(objects.name))[1]))
      or private.try_uuid((storage.foldername(objects.name))[2]) = private.my_employee_location_id()
    )
  );

-- TRUNCATE obchází RLS → klientům nikdy
revoke truncate on all tables in schema public from anon, authenticated;
