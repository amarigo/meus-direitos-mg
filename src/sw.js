// Guarda o aplicativo no aparelho para funcionar sem internet. Não guarda nem envia dados da família.
const CACHE = 'meus-direitos-__VERSAO__';
const ARQUIVOS = ['./', './index.html', './estilo.css', './fontes.css', './motor.js', './seguranca.js', './app.js', './regras.json', './regras.json.sig', './manifest.webmanifest', './icone.svg', './icone-192.png', './icone-512.png',
  './fontes/atkinson-hyperlegible-latin-400-normal.woff2', './fontes/atkinson-hyperlegible-latin-700-normal.woff2', './fontes/bricolage-grotesque-latin-700-normal.woff2', './fontes/bricolage-grotesque-latin-800-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // nada de terceiros
  const regras = url.pathname.endsWith('/regras.json') || url.pathname.endsWith('/regras.json.sig');
  if (regras) {
    // Regras: internet primeiro (para pegar leis novas); sem internet, a cópia guardada.
    const nome = url.pathname.endsWith('.sig') ? './regras.json.sig' : './regras.json';
    e.respondWith(fetch(e.request).catch(() => caches.match(nome)).then(r => r || new Response('', { status: 504 })));
    return;
  }
  // Aplicativo: usa a cópia guardada na hora e atualiza por trás.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const rede = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return r; }).catch(() => hit || caches.match('./index.html'));
    return hit || rede;
  }));
});
