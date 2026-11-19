const { chromium } = require('playwright');
// Předpoklad: npm run db:reset const B = 'http://localhost:3000';const B = 'http://localhost:3000'; npm run dev
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const shots = process.env.SHOTS_DIR ?? require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
  const step = (m) => console.log('✓', m);
  page.on('pageerror', e => console.log('PAGEERROR', e.message));

  await page.goto(B + '/');
  await page.getByRole('link', { name: 'Přihlásit se' }).click();
  await page.getByLabel('E-mail').fill('majitel@demo.cz');
  await page.getByLabel('Heslo').fill('spatne');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.getByText('Nesprávný e-mail nebo heslo.').waitFor(); step('špatné heslo odmítnuto');
  await page.getByLabel('Heslo').fill('demo1234');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await page.waitForURL(B + '/admin'); step('majitel přihlášen → /admin');

  await page.getByRole('link', { name: 'Provozovny', exact: true }).click();
  await page.getByText('3 zaměstnanců').waitFor(); step('seznam provozoven');
  await page.getByRole('link', { name: /Restaurace U Lípy/ }).click();
  await page.waitForURL(/provozovny\/10000000/);
  await page.getByLabel('Jméno').fill('Tomáš Testovací');
  await page.getByLabel('PIN (4 číslice)').fill('4444');
  await page.getByRole('button', { name: 'Přidat zaměstnance' }).click();
  await page.getByText('Tomáš Testovací').waitFor(); step('zaměstnanec přidán');
  await page.screenshot({ path: shots + '/admin-location.png', fullPage: true });

  await page.getByRole('button', { name: 'Spárovat toto zařízení' }).click();
  await page.waitForURL(B + '/tablet');
  await page.getByText('Kdo jste?').waitFor(); step('tablet spárován, majitel odhlášen');
  await page.screenshot({ path: shots + '/tablet-who.png' });

  await page.getByRole('button', { name: 'Jana Nováková' }).click();
  for (const k of '0000') await page.getByRole('button', { name: k, exact: true }).click();
  await page.getByText('Nesprávný PIN.').waitFor(); step('špatný PIN odmítnut');
  await page.screenshot({ path: shots + '/tablet-pin.png' });
  for (const k of '1111') await page.getByRole('button', { name: k, exact: true }).click();
  await page.waitForURL(B + '/ukoly');
  await page.getByText('Jana Nováková').waitFor(); step('Jana přihlášena PINem → /ukoly');
  const adm = await page.goto(B + '/admin'); await page.waitForURL(B + '/ukoly'); step('zaměstnanec nemá přístup do /admin');
  await page.getByRole('button', { name: 'Odhlásit' }).click();
  await page.waitForURL(B + '/tablet'); step('odhlášení zpět na tablet');

  await page.getByRole('button', { name: 'Tomáš Testovací' }).click();
  for (const k of '4444') await page.getByRole('button', { name: k, exact: true }).click();
  await page.waitForURL(B + '/ukoly');
  await page.getByText('Tomáš Testovací').waitFor(); step('nový zaměstnanec přihlášen PINem');

  // nový majitel v čistém kontextu
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(B + '/registrace');
  await p2.getByLabel('Vaše jméno').fill('Eva Nová');
  await p2.getByLabel('E-mail').fill('eva@kavarna-test.cz');
  await p2.getByLabel('Heslo').fill('heslo12345');
  await p2.getByRole('button', { name: 'Vytvořit účet' }).click();
  await p2.waitForURL(B + '/onboarding'); step('registrace → onboarding');
  await p2.getByLabel('Název firmy').fill('Kavárna Test s.r.o.');
  await p2.getByLabel(/IČO/).fill('87654321');
  await p2.getByLabel('Název provozovny').fill('Kavárna na rohu');
  await p2.getByRole('button', { name: 'Založit firmu' }).click();
  await p2.waitForURL(/admin\/provozovny\//);
  await p2.getByRole('heading', { name: 'Kavárna na rohu' }).waitFor(); step('firma + provozovna založena');
  await p2.goto(B + '/admin/provozovny/10000000-0000-4000-8000-000000000001');
  await p2.getByText(/This page could not be found|nenalezen/i).waitFor(); step('nový majitel nevidí provozovnu jiné firmy (404)');
  await p2.screenshot({ path: shots + '/foreign-404.png' });
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
