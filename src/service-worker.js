/* This template is emitted as /sw.js by scripts/pwa.mjs during production builds. */
const {version,assets}=self.__TSECURE_BUILD__;
const cachePrefix='tsecure-shell-';
const cacheName=cachePrefix+version;
const staticPaths=new Set(assets);

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    try{
      await cache.addAll(assets.map(url=>new Request(url,{cache:'reload',credentials:'omit'})));
    }catch(error){await caches.delete(cacheName);throw error;}
    // Updates wait until every open tab is idle. First installation activates
    // normally without requiring a reload or closing the application.
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(cachePrefix)&&name!==cacheName)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

let activationCheck;
async function canActivate(){
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const ready=await Promise.all(clients.map(client=>new Promise(resolve=>{
    const channel=new MessageChannel();
    const finish=safe=>{clearTimeout(timer);channel.port1.close();resolve(safe);};
    const timer=setTimeout(()=>finish(false),1500);
    channel.port1.onmessage=event=>finish(event.data?.safe===true);
    client.postMessage({type:'TSECURE_UPDATE_CHECK'},[channel.port2]);
  })));
  if(!ready.every(Boolean))return false;
  await self.skipWaiting();return true;
}
self.addEventListener('message',event=>{
  if(event.data?.type!=='TSECURE_ACTIVATE_UPDATE')return;
  activationCheck ||= canActivate().finally(()=>{activationCheck=null;});
  event.waitUntil(activationCheck.then(activated=>event.ports[0]?.postMessage({activated})));
});

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Authentication, private APIs, provider traffic, and all submissions bypass
  // the worker entirely. Only explicitly precached public build files are read.
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname==='/api'||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    if(!['/','/index.html'].includes(url.pathname))return;
    event.respondWith((async()=>{
      try{
        const response=await fetch(new Request(request,{cache:'no-store'}));
        if(response.ok)return response;
      }catch{/* The installed build remains available without a connection. */}
      return (await caches.open(cacheName)).match('/index.html');
    })());
  }else if(staticPaths.has(url.pathname)){
    event.respondWith((async()=>{
      const cached=await (await caches.open(cacheName)).match(url.pathname);
      return cached||fetch(request);
    })());
  }
});
