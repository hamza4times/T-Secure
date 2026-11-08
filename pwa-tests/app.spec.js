import {test,expect,chromium} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {callFixture} from '../e2e/call-fixture.js';

async function controlled(page){
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:10000}).toBe(true);
}
async function deployUpdate(page,request){
  await request.get('/__test/release?version=two');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
}
const release=page=>page.locator('meta[name="pwa-test-release"]');

test.beforeEach(async({request})=>{await request.get('/__test/release?version=one');});

test('mobile installation has a valid manifest, working icons, and fresh update headers',async({page,request},testInfo)=>{
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const manifest=await (await request.get(await page.locator('link[rel="manifest"]').getAttribute('href'))).json();
  expect(manifest.name).toBe('T-Secure');
  expect(manifest.display).toBe('standalone');
  expect(new URL(manifest.start_url,page.url()).origin).toBe(new URL(page.url()).origin);
  for(const icon of manifest.icons){
    const image=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return `${img.naturalWidth}x${img.naturalHeight}`;},icon.src);
    expect(image).toBe(icon.sizes);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  for(const url of ['/','/index.html','/sw.js','/manifest.webmanifest']){
    const response=await request.get(url);
    expect(response.ok(),url).toBe(true);
    expect(response.headers()['cache-control'],url).toMatch(/no-cache|no-store/);
  }
  await controlled(page);
  // Ordinary Playwright contexts are incognito, where Chrome disables app
  // installation. Check eligibility in an isolated, normal Chrome profile.
  // Keep Windows profile paths short enough for Chrome's nested CacheStorage.
  const profile=await mkdtemp(path.resolve('artifacts/pwa/profile-'));
  const installContext=await chromium.launchPersistentContext(profile,{
    channel:'chrome',viewport:testInfo.project.use.viewport,
    isMobile:testInfo.project.use.isMobile,hasTouch:testInfo.project.use.hasTouch,
    userAgent:testInfo.project.use.userAgent,deviceScaleFactor:testInfo.project.use.deviceScaleFactor,
  });
  try{
    const installPage=installContext.pages()[0];
    await installPage.goto(page.url());await controlled(installPage);
    const cdp=await installContext.newCDPSession(installPage);
    const {installabilityErrors}=await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  }finally{await installContext.close();}
  await page.screenshot({path:`artifacts/pwa/online-${testInfo.project.name}.png`,fullPage:true});
});

test('the cached app reopens offline and local message checks still work',async({page,context},testInfo)=>{
  await page.goto('/#/learn');await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Small habits. Stronger protection.'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:/offline/i})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/pwa/offline-${testInfo.project.name}.png`,fullPage:true});
  await page.goto('/#/messages');
  await page.getByLabel('Message or website address').fill('Send me your verification code immediately.');
  await page.getByRole('button',{name:'Check for warning signs',exact:true}).click();
  await expect(page.getByRole('heading',{name:'High-risk warning'})).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({hasText:/offline/i})).toBeHidden();
});

test('private API responses and submissions never enter the app cache',async({page,context})=>{
  await page.goto('/');await controlled(page);
  const responses=await page.evaluate(async()=>{
    const first=await (await fetch('/api/private')).json();
    const second=await (await fetch('/api/private')).json();
    await fetch('/api/private',{method:'POST',body:'private draft'});
    const paths=[];
    for(const name of await caches.keys())for(const request of await (await caches.open(name)).keys())paths.push(new URL(request.url).pathname);
    return {first,second,paths};
  });
  expect(responses.first.request).not.toBe(responses.second.request);
  expect(responses.paths.some(path=>path.startsWith('/api/'))).toBe(false);
  await context.setOffline(true);
  expect(await page.evaluate(()=>fetch('/api/private').then(()=>false,()=>true))).toBe(true);
});

test('an open app automatically loads a new release without reinstalling',async({page,request})=>{
  await page.goto('/');await controlled(page);
  await expect(release(page)).toHaveAttribute('content','one');
  await page.evaluate(()=>{window.firstDocument=true;});
  await deployUpdate(page,request);
  await expect(release(page)).toHaveAttribute('content','two',{timeout:15000});
  expect(await page.evaluate(()=>Boolean(window.firstDocument))).toBe(false);
  const caches=await page.evaluate(()=>window.caches.keys());
  expect(caches.filter(name=>name.startsWith('tsecure-shell-'))).toHaveLength(1);
});

test('an update preserves a message draft until the user leaves the form',async({page,request})=>{
  await page.goto('/#/messages');await controlled(page);
  const field=page.getByLabel('Message or website address');
  await field.fill('An unsent private draft');
  await deployUpdate(page,request);
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  await expect(release(page)).toHaveAttribute('content','one');
  await expect(field).toHaveValue('An unsent private draft');
  // A safe tab cannot force an update over a draft in another tab.
  const other=await page.context().newPage();await other.goto('/');
  const activation=await other.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    return new Promise(resolve=>{
      const channel=new MessageChannel();channel.port1.onmessage=event=>resolve(event.data.activated);
      registration.waiting.postMessage({type:'TSECURE_ACTIVATE_UPDATE'},[channel.port2]);
    });
  });
  expect(activation).toBe(false);
  await expect.poll(()=>other.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  await page.goto('/#/learn');
  await expect(release(page)).toHaveAttribute('content','two',{timeout:15000});
  await expect(release(other)).toHaveAttribute('content','two',{timeout:15000});
});

test('an update waits for a paused or active call to end',async({page,request})=>{
  const providers=await callFixture(page);
  // Model an upstream analysis that has not replied when the user ends the call.
  await page.route('**/api/call',route=>{
    if(route.request().postDataJSON().action==='analyze')return;
    return route.fallback();
  });
  await page.goto('/#/calls');await controlled(page);
  await page.getByRole('button',{name:'Start practice call'}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  const analyzing=page.waitForRequest(req=>req.url().endsWith('/api/call')&&req.postDataJSON()?.action==='analyze');
  providers.say('This is a normal conversation.');
  await analyzing;
  await page.getByRole('button',{name:'Pause call',exact:true}).click();
  await deployUpdate(page,request);
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  await expect(release(page)).toHaveAttribute('content','one');
  await page.getByRole('button',{name:'Resume call',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(release(page)).toHaveAttribute('content','two',{timeout:15000});
});
