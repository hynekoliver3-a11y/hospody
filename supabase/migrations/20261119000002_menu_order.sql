-- Veřejný jídelní lístek: pořadí dle sort_order (pořadí v menu), ne abecedně podle kategorie.
create or replace function public.public_allergen_menu(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'location', jsonb_build_object('name', l.name, 'address', l.address),
    'company',  jsonb_build_object('name', c.name),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', mi.name, 'description', mi.description, 'category', mi.category,
               'price', mi.price, 'allergens', mi.allergens)
             order by mi.sort_order, mi.created_at, mi.name)
      from public.menu_items mi where mi.location_id = l.id and mi.active
    ), '[]'::jsonb)
  )
  from public.locations l join public.companies c on c.id = l.company_id
  where l.public_slug = p_slug;
$$;
