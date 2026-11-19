// HACCP deník – service worker.
// - statické soubory Next.js: cache-first (mají v názvu hash)
// - stránky tabletu (/tablet, /ukoly): network-first, při výpadku poslední uložená verze
// - jinak offline stránka. POST (server actions) a požadavky na Supabase se nezachytávají.
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const OFFLINE_PAGES = ["/tablet", "/ukoly"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    const cacheable = OFFLINE_PAGES.includes(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          // ukládat jen úspěšné odpovědi bez přesměrování (ne přihlašovací stránku)
          if (cacheable && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (cacheable && (await caches.match(url.pathname))) || (await caches.match(OFFLINE_URL))),
    );
  }
});
