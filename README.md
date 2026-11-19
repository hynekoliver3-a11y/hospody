# HACCP deník

Digitální náhrada papírových hygienických záznamů pro restaurace, kavárny a bistra.
Zaměstnanci na sdíleném tabletu odklikávají úkoly (teploty, úklid, příjem zboží, trvanlivost),
majitel vidí přehled, dostává upozornění e-mailem a exportuje PDF pro kontrolu hygieny.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind 4 · Supabase (Postgres, Auth, Storage, RLS) · Vercel (+ Cron) · PWA s offline frontou.

**Demo:** https://haccp-denik.vercel.app · majitel `majitel@demo.cz` / `demo1234` · PINy Jana `1111`, Petr `2222`, Lucie `3333`.

---

## Funkce

| Oblast | Kde | Co dělá |
|---|---|---|
| Checklist | `/ukoly` (tablet) | Dnešní úkoly provozovny, teplota mimo limit → povinná nápravná akce, fotka, poznámka. Max. 2 klepnutí. |
| Přihlášení | `/login`, `/tablet` | Majitel e-mailem; zaměstnanec výběrem jména + 4místný PIN na spárovaném tabletu. |
| Úkoly | `/admin/ukoly` | Úprava šablon: frekvence (denně / ráno+večer / týdně), termín, min/max limit, povinná fotka. |
| Přehled | `/admin` | Dnešní plnění v %, posledních 7 dní, úkoly po termínu, odchylky s fotkami. |
| Upozornění | `/api/cron/alerts` | Každou hodinu: nesplněné úkoly + nové odchylky → e-mail majiteli (Resend). Každá věc se hlásí jen jednou. |
| Export | `/admin/export` | PDF A4: hlavička firmy a provozovny, záznamy po dnech, odchylky a nesplněné úkoly zvýrazněné, kdo záznam provedl. |
| Alergeny | `/admin/alergeny`, `/menu/<slug>` | Jídla + 14 alergenů (EU 1169/2011), PDF tabulka s QR kódem, veřejná stránka pro hosty. |
| PWA / offline | `sw.js`, IndexedDB | Instalovatelné na tablet; bez signálu se záznamy (i fotky) uloží do zařízení a odešlou po připojení. |

## Spuštění lokálně

Potřebujete Node.js 20+ a Docker (pro lokální Supabase).

```bash
npm install
npm run db:start          # lokální Supabase (Postgres, Auth, Storage) v Dockeru
npm run db:reset          # migrace + ukázková data (supabase/seed.sql)
npx supabase status       # vypíše API URL, anon a service_role klíč
cp .env.example .env.local   # doplňte klíče ze `supabase status`
npm run dev               # http://localhost:3000
```

Tablet lokálně: přihlaste se jako majitel → Provozovny → Restaurace U Lípy → **Spárovat toto zařízení** → vyberte zaměstnance a zadejte PIN.

### Testy

```bash
npm test                  # unit testy (termíny, časová pásma, odchylky, statistiky)
npm run db:test           # RLS: firma A nevidí data firmy B (a další oprávnění)
npm run test:e2e          # Playwright: přihlášení, checklist, přehled/export/alergeny (běžící `npm run dev`, čerstvý `db:reset`)
npm run build && npx next start -p 3001 & BASE_URL=http://localhost:3001 node tests/e2e/offline.e2e.cjs   # offline fronta (service worker běží jen v produkčním buildu)
npm run db:test:plain     # RLS testy bez Dockeru proti čistému PostgreSQL
```

Cron lokálně: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/alerts` (`?dry=1` = nic neodešle).

## Proměnné prostředí

| Proměnná | Povinná | Popis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ano | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ano | anon (publishable) klíč – smí být v prohlížeči |
| `SUPABASE_SERVICE_ROLE_KEY` | ano | **tajný** service_role klíč – jen server (PIN přihlášení, tablety, cron, zakládání účtů zaměstnanců) |
| `NEXT_PUBLIC_SITE_URL` | ano | veřejná adresa aplikace (odkazy v e-mailech, QR kód) |
| `CRON_SECRET` | ano | náhodný řetězec; Vercel Cron ho posílá v `Authorization: Bearer …` |
| `RESEND_API_KEY` | pro e-maily | klíč z resend.com |
| `ALERT_FROM_EMAIL` | pro e-maily | odesílatel, např. `HACCP deník <upozorneni@vase-domena.cz>` (doména ověřená v Resend) |
| `EMPLOYEE_EMAIL_DOMAIN` | ne | doména technických účtů zaměstnanců (výchozí `employees.invalid`, nikdy se na ni neposílá pošta) |

## Nasazení (Vercel + Supabase)

1. **Supabase:** založte projekt (region Frankfurt `eu-central-1`). Aplikujte migrace:
   `npx supabase link --project-ref <ref>` a `npx supabase db push`.
   Ukázková data jen pro demo: obsah `supabase/seed.sql` spusťte v SQL editoru.
2. **Auth → URL Configuration:** Site URL = adresa aplikace, Redirect URLs = `https://<domena>/**`
   (jinak odkaz v potvrzovacím e-mailu vede na localhost). Pro ostrý provoz nastavte vlastní SMTP – vestavěný má přísný limit.
3. **Vercel:** Add New Project → import repozitáře z GitHubu → doplňte proměnné z tabulky výše → Deploy.
   Region funkcí `fra1` (blízko databáze).
4. **Cron:** Vercel Hobby povoluje jen denní cron (hodinový nasazení odmítne: *„Hobby accounts are limited to daily cron jobs“*).
   Proto `vercel.json` spouští `/api/cron/alerts` 1× denně (záloha) a **hodinovou kontrolu volá Supabase** (`pg_cron` + `pg_net`, viz níže).
   Na Vercel Pro stačí v `vercel.json` změnit schedule na `0 * * * *` a pg_cron job smazat. Deduplikace (`alert_log`) zajistí,
   že souběh obou nepošle nic dvakrát.
5. **Resend:** ověřte doménu odesílatele, vložte `RESEND_API_KEY` a `ALERT_FROM_EMAIL`.

Hodinové volání ze Supabase (alternativa k Vercel Cronu):

```sql
create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.schedule('haccp-alerts', '5 * * * *', $$
  select net.http_get('https://<domena>/api/cron/alerts',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'));
$$);
```

## Architektura

```
src/
  app/
    (auth)/            přihlášení a registrace majitele
    onboarding/        založení firmy + první provozovny (s přednastavenými HACCP úkoly)
    admin/             přehled, úkoly, alergeny, export, provozovny/zaměstnanci/tablety
    tablet/            výběr zaměstnance + PIN (server action pinLogin)
    ukoly/             checklist zaměstnance, offline fronta, automatické odhlášení
    menu/[slug]/       veřejná stránka alergenů (bez přihlášení)
    api/cron/alerts    hodinová kontrola + e-mail
    api/export/*       PDF (HACCP záznamy, tabulka alergenů)
  i18n/                texty v messages/<jazyk>.json, server getT(), klient useT()
  lib/
    tasks/             termíny a časová pásma, vyhodnocení odchylek, statistiky, odeslání záznamu
    offline/queue.ts   IndexedDB fronta
    alerts/            sestavení a odeslání upozornění
    pdf/               šablony PDF (@react-pdf/renderer, font Noto Sans kvůli diakritice)
supabase/
  migrations/          schéma, RLS, RPC, storage
  seed.sql             demo restaurace, 3 zaměstnanci, 14 dní záznamů, menu
  tests/               RLS testy (SQL)
```

**Bezpečnost a multi-tenant**

- Každý řádek nese `company_id` (+ `location_id`); přístup vynucuje RLS přes pomocné funkce ve schématu `private`.
- Role se odvozuje z DB (`company_members`, `employees`), nikdy z `user_metadata`.
- Zaměstnanec má technický Supabase účet bez e-mailové schránky. Server po ověření tokenu tabletu (httpOnly cookie, v DB jen SHA-256)
  a PINu (bcrypt, zámek po 5 pokusech na 5 min) vystaví běžnou session → RLS platí stejně jako pro majitele.
- Záznamy (`task_records`) jsou neměnné (žádný UPDATE/DELETE) – auditní stopa. Trigger doplní snapshot šablony, autora a vyhodnotí odchylku;
  odchylku bez nápravné akce DB odmítne.
- Fotky v privátním bucketu `task-photos/{firma}/{provozovna}/…`, majitel je vidí přes podepsané URL.

**Offline:** service worker ukládá statické soubory a stránky `/tablet`, `/ukoly`. Záznam bez signálu jde do IndexedDB
(s `id` vygenerovaným v zařízení → odeslání je idempotentní), odešle se při obnovení připojení / každých 30 s,
vždy jen pod uživatelem, který ho pořídil. Odhlášení je zablokované, dokud fronta není prázdná.

## Jak rozšířit (mimo MVP)

- **Další jazyk (sk, pl):** zkopírujte `src/i18n/messages/cs.json` → `sk.json`, přeložte, přidejte kód do `src/i18n/config.ts`
  a do katalogu v `src/i18n/messages.ts`. Jazyk se volí cookie `locale` (přepínač stačí nastavit cookie); `companies.locale`
  určuje jazyk e-mailů a výchozích úkolů nové provozovny.
- **Stripe (předplatné za provozovnu):** připravené sloupce `companies.stripe_customer_id`, `locations.subscription_status`.
  Přidat Checkout + webhook `/api/stripe/webhook` (service role aktualizuje `subscription_status`) a v `requireOwner`/tabletu
  blokovat provozovny bez aktivního předplatného. Počet položek předplatného = počet provozoven.
- **Bezdrátová čidla:** `task_templates.sensor_id` + `task_records.source = 'sensor'`. Endpoint `/api/sensors/ingest`
  (autentizace tokenem čidla) vloží záznam service rolí; trigger vyhodnotí odchylku stejně jako u ručního měření.

## Známá omezení MVP

- Statistiky minulých dnů se počítají podle aktuálních šablon (historie změn šablon se nevede).
- Jedna firma na účet majitele (datový model víc firem umožňuje, UI zatím ne).
- Demo účet je veřejný – na demo instanci neukládejte ostrá data.
