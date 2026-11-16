// Keeps the game installable on Android and lets it open without the browser bar.
const SHELL='deni-islam-v3';
const ASSETS=['/','/game.js','/style.css','/layout.js','/maze.js','/characters.js','/monster.js','/tools.js','/lift.js','/voice.js','/ak.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==location.origin)return;
 event.respondWith(fetch(request).then(response=>{
  if(response&&response.ok&&(url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname==='/')){const copy=response.clone();caches.open(SHELL).then(cache=>cache.put(request,copy).catch(()=>{}))}
  return response;
 }).catch(()=>caches.match(request).then(hit=>hit||caches.match('/'))));
});
