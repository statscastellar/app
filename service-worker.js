const CACHE='stats-castellar-1.0.1';

const LOCAL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

const EXTERNAL=[
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(LOCAL);

    // Deixem els exportadors PDF disponibles també sense connexió.
    await Promise.all(EXTERNAL.map(async url=>{
      try{
        const r=await fetch(url,{mode:'cors'});
        if(r.ok) await cache.put(url,r);
      }catch(_){}
    }));

    // Activa aquesta versió sense esperar que desaparegui l'anterior.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    // Elimina les memòries cau de versions anteriors.
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(k=>k.startsWith('stats-castellar-') && k!==CACHE)
        .map(k=>caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if(event.request.method!=='GET') return;

  // Per a la navegació (obrir l'app), primer comprovem si hi ha
  // una versió nova a GitHub. Si no hi ha Internet, fem servir
  // l'index guardat i l'app continua funcionant offline.
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        if(response && response.ok){
          const cache=await caches.open(CACHE);
          await cache.put('./index.html',response.clone());
          return response;
        }
      }catch(_){}

      const cached=await caches.match('./index.html');
      if(cached) return cached;

      return caches.match('./');
    })());
    return;
  }

  // Per a la resta de fitxers mantenim cache-first.
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    if(cached) return cached;

    try{
      const response=await fetch(event.request);
      if(response && (response.ok || response.type==='opaque')){
        const cache=await caches.open(CACHE);
        cache.put(event.request,response.clone());
      }
      return response;
    }catch(err){
      throw err;
    }
  })());
});
