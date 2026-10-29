/* Service worker — Nossas Finanças
 * - Arquivos do próprio app: rede primeiro (você sempre recebe a versão nova), cache só como reserva offline.
 * - CDNs (fontes, ícones, Chart.js): cache primeiro, atualizando em segundo plano.
 * - Google Apps Script (sincronização): nunca passa pelo cache.
 * Ao publicar uma versão nova, altere CACHE (ex.: v3) para limpar o cache antigo.
 */
const CACHE = 'nossas-financas-v3';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u)))) // um arquivo ausente não derruba os outros
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST de sincronização vai direto para a rede
  const url = new URL(req.url);
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('.googleusercontent.com')) return;

  const store = res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  };

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(store).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(r =>
          r || (req.mode === 'navigate' ? caches.match('index.html') : null) || Response.error()
        )
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(store).catch(() => cached || Response.error());
      return cached || net;
    })
  );
});
