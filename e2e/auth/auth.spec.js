import {test,expect} from '@playwright/test';
const root='http://127.0.0.1:9099';
const api=root+'/identitytoolkit.googleapis.com/v1/';
const key='?key=demo-test-key';
const password='Test-password-2026!';
async function signup(page){
  const email='tsecure-'+Date.now()+'@example.test';
  await page.goto('/#/signup');
  await page.getByLabel('Your name',{exact:true}).fill('Taylor');
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByLabel('Confirm password',{exact:true}).fill('Different-password-1');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByText(/passwords do not match/)).toBeVisible();
  await page.getByLabel('Confirm password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Check your inbox.'})).toBeVisible();
  return email;
}
async function verifyEmail(request,email){
  let code;
  await expect.poll(async()=>{
    const codes=await (await request.get(root+'/emulator/v1/projects/demo-tsecure/oobCodes')).json();
    code=codes.oobCodes.findLast((c)=>c.email===email&&c.requestType==='VERIFY_EMAIL');
    return Boolean(code);
  }).toBe(true);
  const response=await request.post(api+'accounts:update'+key,{data:{oobCode:code.oobCode}});
  expect(response.ok()).toBeTruthy();
}
async function finishOnboarding(page){
  await expect(page.getByRole('heading',{name:'Your Personal Protection Profile'})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:/Let’s begin/}).click();
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByLabel('Name',{exact:true}).fill('Jordan');
  await page.getByLabel('Phone number').fill('+1 202 555 0143');
  await page.getByRole('button',{name:'Save contact'}).click();
  await expect(page.locator('.contact-list').getByText('Jordan')).toBeVisible();
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByLabel(/I understand how T-Secure uses my information/).check();
  await page.getByRole('button',{name:/Finish setup/}).click();
  await page.getByRole('link',{name:/Go to my dashboard/}).click();
}
test('signup, verification gate, onboarding, private persistence, reset, and sign-out work',async({page,request})=>{
  const email=await signup(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading',{name:'Check your inbox.'})).toBeVisible();
  await verifyEmail(request,email);
  await page.getByRole('button',{name:'I’ve verified my email'}).click();
  await finishOnboarding(page);
  await expect(page.getByRole('heading',{name:'Welcome back, Taylor.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link',{name:'Call Jordan'})).toHaveAttribute('href','tel:+12025550143');
  await page.goto('/#/messages');
  await page.getByLabel('Message or website address').fill('Send your verification code now.');
  await page.getByRole('button',{name:'Analyze message',exact:true}).click();
  await expect(page.getByRole('heading',{name:'High risk'})).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByRole('heading',{name:'Text message'})).toBeVisible();
  await page.goto('/#/settings');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.goto('/#/login');
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back, Taylor.'})).toBeVisible({timeout:15000});
  await page.goto('/#/settings');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.goto('/#/reset');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
});
test('Google popup cancellation keeps sign-in usable',async({page})=>{
  await page.goto('/#/login');
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Continue with Google'}).click();
  const popup=await popupPromise;
  await popup.close();
  await expect(page.getByText(/Google sign-in was cancelled/)).toBeVisible({timeout:15000});
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();
});
test('APIs reject missing, invalid, and unverified identity tokens',async({request})=>{
  const content={channel:'message',sequence:1,text:'Hello'};
  for(const path of ['/api/analyze','/api/analyze-sms','/api/analyze-call']){
    expect((await request.post(path,{data:content})).status()).toBe(401);
    expect((await request.post(path,{data:content,headers:{Authorization:'Bearer invalid'}})).status()).toBe(401);
  }
  const response=await request.post(api+'accounts:signUp'+key,{data:{email:'unverified-'+Date.now()+'@example.test',password,returnSecureToken:true}});
  const account=await response.json();
  expect((await request.post('/api/analyze-sms',{data:content,headers:{Authorization:'Bearer '+account.idToken}})).status()).toBe(403);
  expect((await request.get('/api/benchmark-models',{headers:{Authorization:'Bearer '+account.idToken}})).status()).toBe(403);
});
