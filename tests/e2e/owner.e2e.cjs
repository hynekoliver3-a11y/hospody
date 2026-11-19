// Fáze 4–6: dashboard, PDF export, alergeny + veřejná QR stránka, ochrana cronu.
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const shots = process.env.SHOTS_DIR ?? os.tmpdir();
const step = (m) => console.log('✓', m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  const cron = await ctx.request.get(B + '/api/cron/alerts');
  if (cron.status() !== 401) throw new Error('cron bez tokenu musí vrátit 401');
  step('cron bez tokenu → 401');
  const anonPdf = await ctx.request.get(B + '/api/export/haccp?location=x&from=2026-01-01&to=2026-01-02');
  if (anonPdf.status() !== 401) throw new Error('export bez přihlášení musí vrátit 401');
  step('export bez přihlášení → 401');

  await page.goto(B + '/login');
  await page.getByLabel('E-mail').fill('majitel@demo.cz');
  await page.getByLabel('Heslo').fill('demo1234');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL(B + '/admin');
  await page.getByText('Dnes splněno').waitFor();
  await page.getByRole('heading', { name: 'Odchylky za posledních 14 dní' }).waitFor();
  step('dashboard: dnešní plnění, 7 dní, odchylky');

  await page.getByRole('link', { name: 'Export', exact: true }).click();
  await page.getByRole('heading', { name: 'Export pro kontrolu hygieny' }).waitFor();
  const qs = await page.locator('form[action="/api/export/haccp"]').evaluate((f) => new URLSearchParams(new FormData(f)).toString());
  const pdfRes = await ctx.request.get(B + '/api/export/haccp?' + qs);
  if (pdfRes.status() !== 200 || !pdfRes.headers()['content-type'].includes('pdf')) throw new Error('PDF export selhal');
  step('export formulář → PDF');

  await page.getByRole('link', { name: 'Alergeny', exact: true }).click();
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Nové jídlo' }) });
  await form.getByLabel('Název jídla').fill('Rajská polévka');
  await form.getByLabel(/Kategorie/).fill('Polévky');
  await form.getByLabel(/Cena/).fill('59');
  await form.getByLabel(/Obiloviny obsahující lepek/).check();
  await form.getByLabel(/Mléko/).check();
  await form.getByRole('button', { name: 'Přidat jídlo' }).click();
  await page.getByText('Rajská polévka', { exact: true }).waitFor();
  step('jídlo s alergeny 1 a 7 přidáno');
  await page.screenshot({ path: path.join(shots, 'allergens-admin.png'), fullPage: true });

  const pdf = await ctx.request.get(B + '/api/export/allergens?location=10000000-0000-4000-8000-000000000001');
  if (pdf.status() !== 200) throw new Error('PDF alergenů selhalo');
  step('PDF tabulka alergenů');

  const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await guest.goto(B + '/menu/u-lipy-brno');
  await guest.getByRole('heading', { name: 'Alergeny – Restaurace U Lípy' }).waitFor();
  await guest.getByText('Rajská polévka').waitFor();
  await guest.getByRole('heading', { name: 'Legenda alergenů' }).waitFor();
  step('veřejná stránka (bez přihlášení) zobrazuje nové jídlo');
  await guest.screenshot({ path: path.join(shots, 'menu-public.png'), fullPage: true });
  const missing = await guest.goto(B + '/menu/neexistuje');
  if (missing.status() !== 404) throw new Error('neznámý slug musí vrátit 404');
  step('neznámá provozovna → 404');
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
