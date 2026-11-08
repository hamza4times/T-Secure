import { test, expect } from '@playwright/test';

// Seeds an onboarded demo profile so feature tests start on the dashboard.
async function demo(page,preferences={}) {
  await page.addInitScript((preferences)=>{
    if(!localStorage.getItem('tsecure:demo:v2'))localStorage.setItem('tsecure:demo:v2',JSON.stringify({active:true,profile:{displayName:'Pat',onboardingCompleted:true,preferences},contacts:[],incidents:[],warnings:[]}));
  },preferences);
}
async function openMenu(page) {
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  if(await menu.isVisible())await menu.click();
}

test('landing explains the product and the demo leads through onboarding to the dashboard',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Protecting the people behind every conversation.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Three levels of protection'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Our privacy commitment'})).toBeVisible();
  await page.getByRole('button',{name:'Explore the demo'}).first().click();
  await expect(page.getByRole('heading',{name:'Your Personal Protection Profile'})).toBeVisible();
  await page.getByRole('button',{name:/Let’s begin/}).click();
  await page.getByLabel(/Fewer interruptions/).check();
  await page.getByLabel(/family passphrase/i).check();
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByLabel('What should we call you?').fill('Pat');
  await page.getByLabel('Large',{exact:true}).check();
  await expect(page.locator('html')).toHaveAttribute('data-text-size','large');
  await page.getByRole('button',{name:/Continue/}).click();
  await expect(page.getByRole('heading',{name:/Trusted contacts/})).toBeVisible();
  await page.getByRole('button',{name:/Skip for now/}).click();
  await page.getByRole('button',{name:/Finish setup/}).click();
  await expect(page.getByText(/Please confirm you understand/)).toBeVisible();
  await page.getByLabel(/I understand how T-Secure uses my information/).check();
  await page.getByRole('button',{name:/Finish setup/}).click();
  await expect(page.getByRole('heading',{name:/You’re all set, Pat/})).toBeVisible();
  await page.getByRole('link',{name:/Go to my dashboard/}).click();
  await expect(page.getByRole('heading',{name:'Welcome back, Pat.'})).toBeVisible();
  await expect(page.getByText(/Interrupting only for high risk/)).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size','large');
});
test('message scanner explains Scenario B and never turns suspicious input into a link',async({page})=>{
  await demo(page);
  await page.goto('/#/messages');
  await page.getByRole('button',{name:/Scenario B/}).click();
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.getByRole('heading',{name:'High risk'})).toBeVisible();
  await expect(page.getByText(/Claims to be:/)).toBeVisible();
  await expect(page.getByText('Request: Open a link',{exact:false}).first()).toBeVisible();
  await expect(page.getByText(/The message refers to a link/)).toBeVisible();
  await page.getByLabel('Message or website address').fill('Send your verification code at https://bank.example@192.0.2.1/login');
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.getByText(/Hides the real destination/)).toBeVisible();
  await expect(page.getByRole('link',{name:/192\.0\.2\.1/})).toHaveCount(0);
  await page.getByLabel('Message or website address').fill('<img src=x onerror=alert(1)> Hello there');
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.locator('main img')).toHaveCount(0);
});
test('a genuine urgent text stays low risk',async({page})=>{
  await demo(page);
  await page.goto('/#/messages');
  await page.getByRole('button',{name:'Urgent but genuine'}).click();
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Low risk'})).toBeVisible();
});
test('trusted contacts persist and are only dialed through an explicit action',async({page})=>{
  await demo(page);
  await page.goto('/#/settings');
  await page.getByLabel('Name',{exact:true}).fill('Jordan');
  await page.getByLabel(/Relationship/).fill('Daughter');
  await page.getByLabel('Phone number').fill('+1 202 555 0143');
  await page.getByRole('button',{name:'Save contact'}).click();
  await expect(page.getByText('Trusted contact saved.')).toBeVisible();
  await page.reload();
  await expect(page.locator('.contact-list').getByText('Jordan')).toBeVisible();
  await page.goto('/#/home');
  await expect(page.getByRole('link',{name:'Call Jordan'})).toHaveAttribute('href','tel:+12025550143');
});
test('Scenario A warns before the money request, with the four warning options',async({page})=>{
  test.setTimeout(80000);
  await demo(page);
  await page.goto('/#/calls');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  await expect(page.getByText('Hey, it\'s me. I\'m in serious trouble.',{exact:true})).toBeVisible();
  await expect(page.locator('#call-timer')).not.toHaveText('0:00',{timeout:3000});
  const warning=page.getByRole('dialog',{name:/Potential financial scam/});
  await expect(warning).toBeVisible({timeout:40000});
  await expect(page.getByText('Can you send the money right now?')).toHaveCount(0);
  await expect(warning.getByText(/may ask you to send money/)).toBeVisible();
  await expect(warning.getByText('Possible family impersonation')).toBeVisible();
  await warning.getByRole('button',{name:'How do I verify this person?'}).click();
  await expect(warning.getByText(/call them on the number already saved/i)).toBeVisible();
  await warning.getByRole('button',{name:'Show detected evidence'}).click();
  await expect(warning.locator('#warning-panel').getByText('Secrecy')).toBeVisible();
  await expect(warning.locator('#warning-panel blockquote').filter({hasText:'tell anyone'})).toBeVisible();
  await warning.getByRole('button',{name:'I need help'}).click();
  await expect(warning.getByText(/Nothing bad happens if you hang up/)).toBeVisible();
  await warning.getByRole('button',{name:'Dismiss warning'}).first().click();
  await expect(warning).not.toBeVisible();
  await expect(page.getByText('Paused',{exact:false}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Manipulation timeline'})).toBeVisible();
  await page.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(page.getByRole('link',{name:/Open the Recovery Assistant/})).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByText(/Your action: Dismissed the warning/)).toBeVisible();
});
test('Scenario C: an urgent genuine call plays to the end without a warning',async({page})=>{
  test.setTimeout(60000);
  await demo(page);
  await page.goto('/#/calls');
  await page.getByLabel('Demonstration scenario').selectOption('legitimate');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  await expect(page.getByText(/Call complete/)).toBeVisible({timeout:40000});
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('region',{name:'Current call warning'})).toHaveCount(0);
  await expect(page.locator('.analysis-panel h2')).toHaveText('Low risk');
});
test('calls pause, resume, restart, and end',async({page})=>{
  await demo(page);
  await page.goto('/#/calls');
  await page.getByLabel('Demonstration scenario').selectOption('checkin');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByText(/^Paused/)).toBeVisible();
  const lines=await page.locator('.turn').count();
  await page.waitForTimeout(5000);
  await expect(page.locator('.turn')).toHaveCount(lines);
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  await expect(page.locator('.turn')).toHaveCount(1);
  await page.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(page.getByText(/Call ended/)).toBeVisible();
});
test('the “fewer interruptions” preference hides caution banners but keeps high warnings',async({page})=>{
  test.setTimeout(60000);
  await demo(page,{warningStyle:'high-only'});
  await page.goto('/#/calls');
  await page.getByLabel('Demonstration scenario').selectOption('government');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  await expect(page.locator('.turn').filter({hasText:'warrant for your arrest'})).toBeVisible({timeout:8000});
  await expect(page.getByRole('region',{name:'Current call warning'})).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible({timeout:16000});
});
test('Recovery Assistant gives guidance for each situation without promising refunds',async({page})=>{
  await demo(page);
  await page.goto('/#/recovery');
  await page.getByRole('button',{name:'I sent money'}).click();
  await expect(page.getByText('Call your bank or payment provider now')).toBeVisible();
  await expect(page.getByText(/recovery isn’t guaranteed/)).toBeVisible();
  await page.getByRole('button',{name:'I shared a verification code'}).click();
  await expect(page.getByText('Contact the company the code belongs to')).toBeVisible();
  await page.getByRole('button',{name:'I am not sure what happened'}).click();
  await page.getByRole('button',{name:/Did you install anything/}).click();
  await expect(page.getByText('Remove remote access')).toBeVisible();
});
test('history records checks without message text and can be deleted',async({page})=>{
  await demo(page);
  await page.goto('/#/messages');
  await page.getByRole('button',{name:'Bank code request'}).click();
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.getByRole('heading',{name:'High risk'})).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByRole('heading',{name:'Text message'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('tsecure:demo:v2'))).not.toContain('verification code to restore');
  page.once('dialog',(dialog)=>dialog.accept());
  await page.getByRole('button',{name:'Delete all'}).click();
  await expect(page.getByRole('heading',{name:'A fresh start.'})).toBeVisible();
});
test('developer page measures the rule baseline locally and shows no pre-filled results',async({page})=>{
  await demo(page);
  await page.goto('/#/developer');
  await expect(page.getByRole('heading',{name:'No results yet.'})).toBeVisible();
  await page.getByRole('button',{name:'Run scenarios'}).click();
  await expect(page.getByRole('heading',{name:'Measured results'})).toBeVisible();
  await expect(page.getByRole('row',{name:/Rule-based baseline/})).toContainText('/ 12');
});
test('narrow screens expose every destination in the menu without horizontal overflow',async({page})=>{
  await demo(page);
  await page.setViewportSize({width:320,height:740});
  await page.goto('/#/home');
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await page.getByRole('link',{name:'Protection profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your Personal Protection Profile'})).toBeVisible();
  await menu.click();
  await page.getByRole('link',{name:'T-Life concept preview'}).click();
  await expect(page.getByRole('heading',{name:'Your T-Life profile preview.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/');
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('skip link is the first keyboard stop and leaving a call ends it',async({page})=>{
  await demo(page);
  await page.goto('/#/calls');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.getByRole('button',{name:'Start simulated call'}).click();
  await openMenu(page);
  await page.getByRole('link',{name:'Safety guide',exact:true}).click();
  await openMenu(page);
  await page.getByRole('link',{name:'Call protection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play again'})).toBeVisible();
});
test('optional spoken guidance is fixed advice and stops when a warning is dismissed',async({page})=>{
  test.setTimeout(60000);
  await page.addInitScript(()=>{
    window.testSpoken=[];window.testCancelled=0;
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    Object.defineProperty(window,'speechSynthesis',{value:{speak(u){window.testSpoken.push(u.text);},cancel(){window.testCancelled++;},getVoices(){return [];}}});
  });
  await demo(page);
  await page.goto('/#/calls');
  await page.getByLabel('Warning sound').selectOption('speech');
  await page.getByLabel('Demonstration scenario').selectOption('support');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  const warning=page.getByRole('dialog');
  await expect(warning).toBeVisible({timeout:16000});
  expect(await page.evaluate(()=>window.testSpoken)).toEqual(['Take a moment. Pause and verify the caller before acting.','Possible scam. Pause and verify the caller using a number you already trust.']);
  const cancelledBefore=await page.evaluate(()=>window.testCancelled);
  await warning.getByRole('button',{name:'Dismiss warning'}).first().click();
  expect(await page.evaluate(()=>window.testCancelled)).toBeGreaterThan(cancelledBefore);
});
test('high-risk warning actions stay reachable at a zoom-equivalent viewport',async({page})=>{
  await demo(page);
  await page.setViewportSize({width:720,height:500});
  await page.goto('/#/calls');
  await page.getByLabel('Demonstration scenario').selectOption('support');
  await page.getByRole('button',{name:'Start simulated call'}).click();
  const warning=page.getByRole('dialog');
  await expect(warning).toBeVisible({timeout:16000});
  await expect(warning.getByRole('button',{name:'End demo call'})).toBeInViewport();
  await expect(warning.getByRole('button',{name:'Show detected evidence'})).toBeInViewport();
});
