// Fáze 3: checklist zaměstnance + správa úkolů. Předpoklad: npm run db:reset && npm run dev
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const shots = process.env.SHOTS_DIR ?? os.tmpdir();
const step = (m) => console.log('✓', m);

function tinyPng() {
  const file = path.join(os.tmpdir(), 'haccp-e2e.png');
  fs.writeFileSync(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAwMDAxMDAAAAP/AH/q0ckjQAAAABJRU5ErkJggg==', 'base64'));
  return file;
}

(async () => {
  const browser = await chromium.launch();
  const owner = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext({ viewport: { width: 820, height: 1180 } })).newPage();
  [owner, tablet].forEach((p) => p.on('pageerror', (e) => console.log('PAGEERROR', e.message)));

  // majitel přidá úkol "Vinotéka" (teplota 10–14, ráno a večer)
  await owner.goto(B + '/login');
  await owner.getByLabel('E-mail').fill('majitel@demo.cz');
  await owner.getByLabel('Heslo').fill('demo1234');
  await owner.getByRole('button', { name: 'Přihlásit se' }).click();
  await owner.waitForURL(B + '/admin');
  await owner.getByRole('link', { name: 'Úkoly', exact: true }).click();
  const newForm = owner.locator('section', { has: owner.getByRole('heading', { name: 'Nový úkol' }) });
  await newForm.getByLabel('Název').fill('Vinotéka');
  await newForm.getByLabel('Typ').selectOption('temperature');
  await newForm.getByLabel('Frekvence').selectOption('morning_evening');
  await newForm.getByLabel('Ráno do').fill('08:00');
  await newForm.getByLabel('Večer do').fill('23:30');
  await newForm.getByRole('button', { name: 'Přidat úkol' }).click();
  await newForm.getByText('U teploty vyplňte minimum nebo maximum.').waitFor();
  step('validace: teplota bez limitu odmítnuta');
  await newForm.getByLabel('Minimum').fill('10');
  await newForm.getByLabel('Maximum').fill('14');
  await newForm.getByRole('button', { name: 'Přidat úkol' }).click();
  await owner.getByText('Vinotéka', { exact: true }).waitFor();
  step('majitel přidal úkol Vinotéka');
  await owner.screenshot({ path: path.join(shots, 'admin-templates.png'), fullPage: true });

  // spárování tabletu (v kontextu tabletu)
  await tablet.goto(B + '/login');
  await tablet.getByLabel('E-mail').fill('majitel@demo.cz');
  await tablet.getByLabel('Heslo').fill('demo1234');
  await tablet.getByRole('button', { name: 'Přihlásit se' }).click();
  await tablet.waitForURL(B + '/admin');
  await tablet.goto(B + '/admin/provozovny/10000000-0000-4000-8000-000000000001');
  await tablet.getByRole('button', { name: 'Spárovat toto zařízení' }).click();
  await tablet.waitForURL(B + '/tablet');
  await tablet.getByRole('button', { name: 'Jana Nováková' }).click();
  for (const k of '1111') await tablet.getByRole('button', { name: k, exact: true }).click();
  await tablet.waitForURL(B + '/ukoly');
  await tablet.getByText(/Hotovo \d+ z \d+/).waitFor();
  step('Jana vidí checklist');
  await tablet.screenshot({ path: path.join(shots, 'checklist-before.png'), fullPage: true });

  const card = (title) => tablet.locator('article', { has: tablet.getByRole('heading', { name: title }) });

  // 1) teplota v limitu
  const vinoMorning = card(/Ráno:\s*Vinotéka/);
  await vinoMorning.getByLabel(/Teplota/).fill('12,5');
  await vinoMorning.getByRole('button', { name: 'Uložit', exact: true }).click();
  await vinoMorning.getByText(/✓ 12,5 °C/).waitFor();
  step('teplota 12,5 °C uložena (2 kroky: zadat + uložit)');

  // 2) teplota mimo limit → povinná nápravná akce
  const vinoEvening = card(/Večer:\s*Vinotéka/);
  await vinoEvening.getByLabel(/Teplota/).fill('17');
  await vinoEvening.getByText('Mimo limit! Popište, co jste udělali.').waitFor();
  await vinoEvening.getByRole('button', { name: 'Uložit odchylku' }).click();
  await vinoEvening.getByText('Vyplňte nápravnou akci.').waitFor();
  step('odchylka bez nápravné akce zablokována');
  await vinoEvening.getByLabel('Mimo limit! Popište, co jste udělali.').fill('Víno přesunuto do sklepa, servis objednán.');
  await vinoEvening.getByRole('button', { name: 'Uložit odchylku' }).click();
  await vinoEvening.getByText(/Odchylka/).waitFor();
  step('odchylka 17 °C uložena s nápravnou akcí');

  // 3) úklid jedním klepnutím
  const cleaning = card('Úklid a dezinfekce pracovních ploch');
  await cleaning.getByRole('button', { name: '✓ Hotovo' }).click();
  await cleaning.locator('li').first().waitFor();
  step('úklid odkliknut 1 klepnutím');

  // 4) příjem zboží s fotkou a poškozeným obalem
  const receipt = card('Příjem zboží');
  await receipt.getByRole('button', { name: /Zapsat příjem|Další příjem/ }).click();
  await receipt.getByLabel('Dodavatel').fill('Bidfood');
  await receipt.getByLabel('Zboží').fill('kuřecí prsa');
  await receipt.getByLabel(/Teplota/).fill('3');
  await receipt.getByRole('radio', { name: 'Obal poškozený' }).click();
  await receipt.getByLabel('Odchylka při příjmu – uveďte, co jste udělali.').fill('Vráceno dodavateli.');
  await receipt.getByRole('button', { name: '+ Fotka / poznámka' }).click();
  await receipt.getByLabel('Fotka').setInputFiles(tinyPng());
  await receipt.getByRole('button', { name: 'Uložit odchylku' }).click();
  await receipt.getByText(/Bidfood.*📷|📷/).first().waitFor();
  step('příjem zboží s fotkou a odchylkou uložen');
  await tablet.waitForTimeout(800);
  await tablet.screenshot({ path: path.join(shots, 'checklist-after.png'), fullPage: true });

  await browser.close();
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
