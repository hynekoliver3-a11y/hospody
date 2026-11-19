// Fáze 7: offline fronta. Předpoklad: produkční build (service worker) – npm run build && npm start
const { chromium } = require('playwright');
const B = process.env.BASE_URL ?? 'http://localhost:3001';
const step = (m) => console.log('✓', m);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  await page.goto(B + '/login');
  await page.getByLabel('E-mail').fill('majitel@demo.cz');
  await page.getByLabel('Heslo').fill('demo1234');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL(B + '/admin');
  // vlastní úkol s pozdním termínem, ať test nezávisí na denní době
  await page.goto(B + '/admin/ukoly');
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Nový úkol' }) });
  await form.getByLabel('Název').fill('Offline lednice');
  await form.getByLabel('Typ').selectOption('temperature');
  await form.getByLabel('Termín').fill('23:59');
  await form.getByLabel('Maximum').fill('5');
  await form.getByRole('button', { name: 'Přidat úkol' }).click();
  await page.getByText('Offline lednice', { exact: true }).waitFor();
  await page.goto(B + '/admin/provozovny/10000000-0000-4000-8000-000000000001');
  await page.getByRole('button', { name: 'Spárovat toto zařízení' }).click();
  await page.waitForURL(B + '/tablet');
  await page.getByRole('button', { name: 'Petr Svoboda' }).click();
  for (const k of '2222') await page.getByRole('button', { name: k, exact: true }).click();
  await page.waitForURL(B + '/ukoly');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // stránka teď prošla service workerem → je v cache
  await page.getByText(/Hotovo \d+ z \d+/).waitFor();
  step('service worker aktivní, checklist v cache');

  await ctx.setOffline(true);
  const card = page.locator('article', { has: page.getByRole('heading', { name: 'Offline lednice' }) });
  await card.getByLabel(/Teplota/).fill('3,5');
  await card.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.getByText('Uloženo v zařízení – odešle se po připojení').waitFor();
  await page.getByText(/Jste offline/).waitFor();
  step('offline: záznam uložen do zařízení');

  await page.reload();
  await page.getByText('Uloženo v zařízení – odešle se po připojení').waitFor();
  step('offline reload: stránka z cache, čekající záznam stále vidět');

  await page.getByRole('button', { name: 'Odhlásit' }).click();
  await page.getByText(/Nejdřív se připojte k internetu/).waitFor();
  step('odhlášení zablokováno, dokud záznam čeká');

  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Uloženo v zařízení – odešle se po připojení').waitFor({ state: 'detached', timeout: 20000 });
  await card.getByText(/✓ 3,5 °C/).waitFor();
  step('po připojení odesláno na server');
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
