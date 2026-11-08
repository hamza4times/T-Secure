// Opens the demo with an onboarded sample profile. Set TSECURE_URL to target another server.
export const BASE=process.env.TSECURE_URL||'http://127.0.0.1:5173/';
export async function openDemo(page) {
  await page.addInitScript(()=>{
    if(!localStorage.getItem('tsecure:demo:v2'))localStorage.setItem('tsecure:demo:v2',JSON.stringify({active:true,profile:{displayName:'Pat',onboardingCompleted:true,preferences:{}},contacts:[],incidents:[],warnings:[]}));
  });
  await page.goto(BASE+'#/home');
  await page.getByRole('heading',{name:/Welcome back/}).waitFor();
}
export async function navigate(page,route) {
  await page.evaluate((destination)=>new Promise((resolve)=>{
    location.hash='/'+destination;
    requestAnimationFrame(()=>requestAnimationFrame(resolve));
  }),route);
  await page.locator('main, #main').first().waitFor();
}
