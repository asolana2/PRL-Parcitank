/* PRL Parcitank — service worker
   1) Recibe archivos compartidos desde otras apps (Android: OneDrive/Teams → Compartir → PRL Parcitank)
   2) Guarda la app en caché para que abra sin internet (los datos van aparte)
*/
const CACHE = "prl-app-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

function idb(){ return new Promise((res, rej) => { const r = indexedDB.open("prl-app", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvSet(k, v){ const db = await idb(); await new Promise((res, rej) => { const t = db.transaction("kv","readwrite").objectStore("kv").put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil((async () => { for(const k of await caches.keys()) if(k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // archivos compartidos con la app
  if(e.request.method === "POST" && url.pathname.endsWith("/compartir")){
    e.respondWith((async () => {
      try{
        const fd = await e.request.formData(); const files = fd.getAll("archivos");
        const items = []; for(const f of files) items.push({ nombre: f.name, tipo: f.type, fecha: f.lastModified || Date.now(), buf: await f.arrayBuffer() });
        await kvSet("compartido", items);
      }catch(err){}
      return Response.redirect(new URL("./?compartido=1", url).href, 303);
    })());
    return;
  }
  if(e.request.method !== "GET") return;
  // la app: red primero, caché si no hay red
  if(e.request.mode === "navigate" || SHELL.some(s => url.pathname.endsWith(s.replace("./","/")) )){
    e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)).catch(()=>{}); return r; }).catch(() => caches.match(e.request, { ignoreSearch:true }).then(r => r || caches.match("./index.html"))));
  }
});
