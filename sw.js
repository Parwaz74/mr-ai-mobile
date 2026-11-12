'use strict';
const CACHE='mr-ai-mobile-v0-10-10';
const OWN_OLD_CACHES=['mr-ai-mobile-v0-10-2','mr-ai-mobile-v0-10-6','mr-ai-mobile-v0-10-7','mr-ai-mobile-v0-10-8','mr-ai-mobile-v0-10-9','mr-ai-v08-1-cache','mr-ai-v08-2-cache','mr-ai-v08-3-cache','mr-ai-v08-4-cache','mr-ai-v08-5-cache'];
const CORE=['./','./index.html','./style.css','./app.js','./media-studio.js','./config.js','./ai-client.js','./manifest.webmanifest','./assets/mr-ai-logo.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>OWN_OLD_CACHES.includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>{
    if(cached)return cached;
    return fetch(request).then(response=>{
      if(response.ok&&response.type!=='opaque'){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>request.mode==='navigate'?caches.open(CACHE).then(cache=>cache.match('./index.html')).then(page=>page||Response.error()):Response.error());
  }));
});
