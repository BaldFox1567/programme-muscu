// Copie hors ligne de l'app pour GitHub Pages. Si ce fichier manque, l'app marche comme avant, en ligne seulement.
// Stratégie : la copie gardée s'affiche tout de suite (même sans réseau en salle), la version en ligne est
// téléchargée en arrière-plan et sert au lancement suivant. La page est prévenue quand une nouvelle version est prête.
// Ce fichier ne touche jamais au journal : il ne garde que la page.
const CACHE = 'muscu-app';
const SCOPE = new URL(self.registration.scope);
const PAGE = SCOPE.href;
let majPrete = false;

// Seules l'adresse de l'app et son index.html sont servis depuis la copie
const estApp = url => url.origin === SCOPE.origin && (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.html');

const prevenir = () => self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage('maj')));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGE, { cache: 'reload' }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate' || !estApp(new URL(r.url))) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE), copie = await c.match(PAGE);
    const ancienP = copie ? copie.clone().text() : Promise.resolve(null); // lu avant que la page ne consomme la copie
    const reseau = fetch(r.url, { cache: 'no-cache' }).then(async rep => {
      if (rep.ok && rep.type === 'basic') {
        const neuf = await rep.clone().text(), ancien = await ancienP;
        await c.put(PAGE, rep.clone());
        if (ancien !== null && ancien !== neuf) { majPrete = true; prevenir(); }
      }
      return rep;
    });
    if (copie) { e.waitUntil(reseau.catch(() => {})); return copie; }
    return reseau;
  })());
});

// La page demande au démarrage si une nouvelle version est arrivée pendant son chargement
self.addEventListener('message', e => {
  if (e.data === 'maj?' && majPrete && e.source) { majPrete = false; e.source.postMessage('maj'); }
});
