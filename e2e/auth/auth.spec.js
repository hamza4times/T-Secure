import {test,expect} from '@playwright/test';
const root='http://127.0.0.1:9099';
const api=root+'/identitytoolkit.googleapis.com/v1/';
const key='?key=demo-test-key';
async function signup(page,advanced=false){
  const email='tsecure-'+Date.now()+'@example.test';
  await page.goto('/#/account');
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await expect(page.getByLabel('Enable advanced AI analysis')).not.toBeChecked();
  await page.getByLabel('Your name',{exact:true}).fill('Taylor');
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Test-password-2026!');
  if(advanced)await page.getByLabel('Enable advanced AI analysis').check();
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
test('email signup, verification, private contact persistence, reset, and sign-out work',async({page,request})=>{
  const email=await signup(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading',{name:'Check your inbox.'})).toBeVisible();
  await verifyEmail(request,email);
  await page.getByRole('button',{name:'I’ve verified my email'}).click();
  await expect(page.getByRole('heading',{name:'Protection, on your terms.'})).toBeVisible({timeout:15000});
  await page.getByLabel('Contact name').fill('Jordan');
  await page.getByLabel('Relationship').fill('Friend');
  await page.getByLabel('Phone number').fill('+1 202 555 0143');
  await page.getByRole('button',{name:'Save trusted contact'}).click();
  await expect(page.getByText('Trusted contact saved.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Contact name')).toHaveValue('Jordan');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  await page.getByLabel('Email address',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Test-password-2026!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'A little pause. A safer next step.'})).toBeVisible({timeout:15000});
  await page.goto('/#/settings');
  await expect(page.getByLabel('Contact name')).toHaveValue('Jordan');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
});
test('advanced opt-in survives verification and provider failure leaves standard protection usable',async({page,request})=>{
  const email=await signup(page,true);
  await verifyEmail(request,email);
  await page.getByRole('button',{name:'I’ve verified my email'}).click();
  await expect(page.getByRole('heading',{name:'A little pause. A safer next step.'})).toBeVisible({timeout:15000});
  await page.getByRole('link',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('Enable advanced AI analysis')).toBeChecked();
  await page.getByLabel('Enable advanced AI analysis').uncheck();
  await expect(page.getByText('Advanced analysis is off. Your assessment has been removed.',{exact:true})).toBeVisible();
  await page.goto('/#/messages');
  await page.getByLabel('Message or website address').fill('Send your verification code now.');
  await page.getByRole('button',{name:'Check for warning signs',exact:true}).click();
  await expect(page.getByRole('heading',{name:'High-risk warning'})).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByRole('heading',{name:'Message check',exact:true})).toBeVisible();
});
test('Google popup cancellation keeps sign-in usable',async({page})=>{
  await page.goto('/#/account');
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Continue with Google'}).click();
  const popup=await popupPromise;
  await popup.close();
  await expect(page.getByText(/Google sign-in was cancelled/)).toBeVisible({timeout:15000});
  await expect(page.getByRole('button',{name:'Continue with Google'})).toBeEnabled();
});
test('API rejects missing, invalid, and unverified identity tokens',async({request})=>{
  const content={channel:'message',sequence:1,text:'Hello'};
  expect((await request.post('/api/analyze',{data:content})).status()).toBe(401);
  expect((await request.post('/api/analyze',{data:content,headers:{Authorization:'Bearer invalid'}})).status()).toBe(401);
  const response=await request.post(api+'accounts:signUp'+key,{data:{email:'unverified-'+Date.now()+'@example.test',password:'Test-password-2026!',returnSecureToken:true}});
  const account=await response.json();
  expect((await request.post('/api/analyze',{data:content,headers:{Authorization:'Bearer '+account.idToken}})).status()).toBe(403);
});
