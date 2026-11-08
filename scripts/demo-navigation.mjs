export async function openDemo(page) {
  await page.goto('http://127.0.0.1:5173/');
  const demo=page.getByRole('link',{name:'Explore the local demo',exact:false});
  await page.getByRole('heading',{name:/Welcome back\.|A little pause\. A safer next step\./}).waitFor();
  if(await demo.count())await demo.click();
  await page.getByRole('heading',{name:'A little pause. A safer next step.'}).waitFor();
}
export async function navigate(page,route) {
  await page.evaluate((destination)=>new Promise((resolve)=>{
    location.hash='/'+destination;
    requestAnimationFrame(()=>requestAnimationFrame(resolve));
  }),route);
  await page.locator('main').waitFor();
}
