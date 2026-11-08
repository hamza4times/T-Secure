function hasFormDraft(){
  return [...document.querySelectorAll('form input,form textarea,form select')].some(field=>{
    if(['submit','button','hidden'].includes(field.type))return false;
    if(['checkbox','radio'].includes(field.type))return field.checked!==field.defaultChecked;
    if(field.tagName==='SELECT'){
      const defaults=[...field.options].filter(option=>option.defaultSelected);
      const initial=defaults.length?defaults.map(option=>option.value):[field.options[0]?.value];
      return [...field.selectedOptions].map(option=>option.value).join('\0')!==initial.join('\0');
    }
    return field.value!==field.defaultValue;
  });
}

export function registerPwa({enabled=true,isBusy=()=>false}={}){
  const connection=document.querySelector('#connection-status');
  const showConnection=()=>{if(connection)connection.hidden=navigator.onLine;};
  window.addEventListener('online',showConnection);
  window.addEventListener('offline',showConnection);
  showConnection();
  if(!enabled||!window.isSecureContext||!('serviceWorker' in navigator))return;

  let registration,pendingReload=false,reloading=false,lastActivation=0;
  let controlled=Boolean(navigator.serviceWorker.controller);
  const safe=()=>!isBusy()&&!hasFormDraft()
    && !document.querySelector('dialog[open],form [type="submit"]:disabled')
    && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const tick=()=>{
    if(reloading||!navigator.onLine||document.visibilityState!=='visible'||!safe())return;
    if(pendingReload){reloading=true;window.location.reload();return;}
    if(registration?.waiting&&Date.now()-lastActivation>5000){
      lastActivation=Date.now();
      registration.waiting.postMessage({type:'TSECURE_ACTIVATE_UPDATE'});
    }
  };
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='TSECURE_UPDATE_CHECK')event.ports[0]?.postMessage({safe:safe()});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(controlled)pendingReload=true;
    controlled=true;tick();
  });
  const check=()=>{
    if(navigator.onLine&&document.visibilityState==='visible')registration?.update().catch(()=>{});
    tick();
  };
  async function start(){
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
      registration.addEventListener('updatefound',()=>{
        registration.installing?.addEventListener('statechange',tick);
      });
      tick();
      setInterval(check,60000);
      setInterval(tick,1000);
      window.addEventListener('online',check);
      window.addEventListener('focus',check);
      document.addEventListener('visibilitychange',check);
    }catch(error){console.warn('T-Secure installation is unavailable; the website remains usable.',error);}
  }
  if(document.readyState==='complete')start();
  else window.addEventListener('load',start,{once:true});
}
