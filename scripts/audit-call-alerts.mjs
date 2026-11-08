import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {openDemo,navigate} from './demo-navigation.mjs';
const directory='artifacts/qa/call-alerts';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const report=[];
try{
  await Promise.all([
    ['desktop',1440,1000],['mobile',390,844],['small-mobile',320,740],['landscape',844,390],['zoom-equivalent',720,500],
  ].map(async([name,width,height])=>{
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    async function inspect(state){
      await page.screenshot({path:directory+'/'+name+'-'+state+'.png',fullPage:state!=='high'});
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      const overflow=await page.evaluate(()=>{
        const dialog=document.querySelector('dialog[open]');
        return document.documentElement.scrollWidth>innerWidth||Boolean(dialog&&dialog.scrollWidth>dialog.clientWidth);
      });
      report.push({viewport:name,state,overflow,errors:[...errors],violations:audit.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}))});
    }
    await openDemo(page);
    await navigate(page,'calls');
    await page.getByLabel('Demonstration scenario').selectOption('government');
    await page.getByRole('button',{name:'Start simulated call'}).click();
    await page.getByRole('region',{name:'Current call warning'}).waitFor({timeout:12000});
    await page.getByRole('button',{name:'Pause call',exact:true}).click();
    await inspect('caution');
    await page.getByRole('button',{name:'Resume call',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.waitFor({timeout:15000});
    await inspect('high');
    await dialog.getByRole('button',{name:'End demo call'}).click();
    await page.getByRole('link',{name:/Open the Recovery Assistant/}).waitFor();
    await inspect('after');
    await context.close();
  }));
}finally{await browser.close();}
await writeFile(directory+'/report.json',JSON.stringify(report,null,2));
const failures=report.filter(item=>item.errors.length||item.overflow||item.violations.length);
console.log(JSON.stringify(failures.length?failures:{states:report.length,violations:0,overflow:0,browserErrors:0}));
if(failures.length)process.exitCode=1;
