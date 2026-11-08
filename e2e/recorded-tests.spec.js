import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('recorded examples keep reference labels and constrained results distinct',async({page})=>{
  await page.goto('/');
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('link',{name:'Recorded tests',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Recorded tests',exact:true})).toBeVisible();
  const examples=page.getByRole('navigation',{name:'Recorded test examples'});
  await expect(examples.getByRole('link')).toHaveCount(6);
  await examples.getByRole('link',{name:/Test 3/}).click();
  await expect(page.getByLabel('Reference recording')).toHaveAttribute('src',/gen_audio_MoodID%20training\.mp3$/);
  await expect(page.getByLabel('Target recording')).toHaveAttribute('src',/gen_audio_neutral_scrambled\.mp3$/);
  await expect(page.getByText('The entire reference is labeled “happily”.', {exact:true})).toBeVisible();
  await expect(page.locator('[data-model="gemini"] tbody tr')).toHaveCount(3);
  await expect(page.locator('[data-model="gemini"] tbody tr').first()).toContainText('other');
  await examples.getByRole('link',{name:/Test 4/}).click();
  await expect(page.getByText(/required at least one target segment to be labeled happy/)).toBeVisible();
  await expect(page.locator('[data-model="gemini"] tbody tr').first()).toContainText('Low');
  await page.reload();
  await expect(page.getByRole('heading',{name:/Test 4/})).toBeVisible();
});

test('timestamp controls seek real audio and changing examples stops playback',async({page})=>{
  await page.goto('/#/recorded-tests/1');
  const audio=page.getByLabel('Target recording');
  await page.getByRole('button',{name:'Play target from 00:11 to 00:22',exact:true}).click();
  await expect.poll(()=>audio.evaluate(el=>!el.paused&&el.currentTime>=11&&el.currentTime<22)).toBe(true);
  await expect(page.locator('[data-model="gemini"] tr.is-current')).toContainText('Melancholic');
  await page.evaluate(()=>{window.previousRecordedAudio=document.querySelector('#recorded-target');});
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  if(await menu.isVisible()){
    await menu.click();
    await expect.poll(()=>page.evaluate(()=>!window.previousRecordedAudio.paused)).toBe(true);
    await menu.click();
  }
  await page.getByRole('navigation',{name:'Recorded test examples'}).getByRole('link',{name:/Test 5/}).click();
  expect(await page.evaluate(()=>window.previousRecordedAudio.paused)).toBe(true);
  await page.getByRole('button',{name:'Play target from 00:38 to 01:03',exact:true}).click();
  await expect.poll(()=>audio.evaluate(el=>!el.paused&&el.currentTime>=38&&el.duration>270)).toBe(true);
  await page.getByLabel('Reference recording').evaluate(el=>el.play());
  await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
});

test('human comparison preserves continuation provenance and source files resolve',async({page,request})=>{
  const analysisRequests=[];
  page.on('request',request=>{if(request.url().includes('/api/'))analysisRequests.push(request.url());});
  await page.goto('/#/recorded-tests/6');
  await expect(page.getByLabel('Reference recording')).toHaveCount(0);
  await expect(page.getByText('57.3% time agreement with Gemini',{exact:true})).toBeVisible();
  await expect(page.getByText(/continuation clip starting at 02:25/)).toBeVisible();
  await expect(page.locator('[data-model="nemotron"] tbody tr')).toHaveCount(24);
  await expect(page.locator('[data-model="nemotron"] tbody tr').last()).toContainText('04:33');
  await page.getByText('Submitted prompt', {exact:true}).click();
  await expect(page.locator('#recorded-prompt')).toContainText('No MoodID reference');
  await page.getByText('Scripts and intended labels', {exact:true}).click();
  await expect(page.locator('#recorded-scripts')).toContainText('[matter-of-fact]');
  await page.getByText('Source files', {exact:true}).click();
  for(const href of await page.locator('#recorded-source-files a').evaluateAll(links=>links.map(link=>link.getAttribute('href')))){
    const response=await request.get(href);
    expect(response.ok(),href).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(100);
    expect(response.headers()['content-type']).not.toContain('text/html');
  }
  expect(analysisRequests).toEqual([]);
});

test('recorded tests fit a small phone and timestamp controls work with the keyboard',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/#/recorded-tests/6');
  const time=page.getByRole('button',{name:'Play target from 00:37 to 01:28',exact:true});
  await time.focus();
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.getByLabel('Target recording').evaluate(el=>!el.paused&&el.currentTime>=37)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unavailable audio explains recovery',async({page})=>{
  await page.route('**/recorded-tests/gen_audio_og.mp3',route=>route.abort());
  await page.goto('/#/recorded-tests/1');
  await page.getByRole('button',{name:'Play target from 00:00 to 00:11',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:/recording could not be played/})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download target audio',exact:true})).toHaveAttribute('href',/gen_audio_og\.mp3$/);
});

test('recorded controls expose their visible names to assistive tools',async({page})=>{
  await page.goto('/#/recorded-tests/6');
  await page.getByText('View Nemotron segments',{exact:true}).click();
  const audit=await new AxeBuilder({page}).analyze();
  expect(audit.violations.map(({id})=>id)).toEqual([]);
});
