import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {openDemo,navigate} from './demo-navigation.mjs';
const browser=await chromium.launch({channel:'chrome'});
const report=[];
for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  await openDemo(page);
  for(const route of ['home','messages','calls','settings','profile','t-life','learn','history','recovery','account']){
    await navigate(page,route);
    await page.locator('main').waitFor();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    report.push({viewport:name,route,violations:result.violations.map((v)=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map((n)=>({target:n.target,summary:n.failureSummary}))}))});
    if(route==='settings'){
      await page.getByLabel('Enable advanced AI analysis').check();
      await page.getByText('Assessment ready.',{exact:true}).waitFor();
    }
  }
  await context.close();
}
await browser.close();
await mkdir('artifacts/qa',{recursive:true});
await writeFile('artifacts/qa/accessibility-report.json',JSON.stringify(report,null,2));
const failures=report.filter((r)=>r.violations.length);
console.log(JSON.stringify(failures.length?failures:{pages:report.length,violations:0},null,2));
if(failures.length)process.exitCode=1;
