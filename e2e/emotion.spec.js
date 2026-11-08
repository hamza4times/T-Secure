import {test,expect} from '@playwright/test';
import {callFixture} from './call-fixture.js';

async function setup(page){
  const provider=await callFixture(page);
  await page.addInitScript(()=>{
    window.spokenCheckins=[];
    Object.defineProperty(window,'speechSynthesis',{value:{speak(value){window.spokenCheckins.push(value.text);},cancel(){}}});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  });
  await page.route('**/api/call',async route=>{
    const body=route.request().postDataJSON();
    if(body.action!=='analyze')return route.fallback();
    const turn=body.turns?.findLast(t=>t.speaker==='user');
    const emotion=turn?.text.includes('sad')?{label:'sadness',turnId:turn.id,evidence:turn.text}:{label:'unknown',turnId:null,evidence:''};
    return route.fulfill({json:{risk:'low',reasons:[],emotion,analysisSource:'hybrid',incomplete:false,sessionId:'emotion-call',sequence:body.sequence}});
  });
  await page.goto('/#/calls');return provider;
}

test('emotion check-in is gentle, spoken once when enabled, and resets between calls',async({page},testInfo)=>{
  const provider=await setup(page);
  await page.getByLabel('Call alert audio',{exact:true}).selectOption('speech');
  await page.getByRole('button',{name:'Start practice call',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  provider.say('I feel sad and lonely today.','user');
  const checkin=page.getByRole('region',{name:'Emotional check-in'});
  await expect(checkin).toContainText('You may be feeling sad. Is everything okay?');
  await expect(page.getByRole('region',{name:'Emotion cues'})).toContainText('Possible emotion: sadness');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.spokenCheckins.length)).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('emotion-checkin.png'),fullPage:true});
  provider.say('I still feel sad today.','user');
  await expect(page.getByRole('region',{name:'Emotion cues'})).toContainText('I still feel sad today.');
  expect(await page.evaluate(()=>window.spokenCheckins.length)).toBe(1);
  await checkin.getByRole('button',{name:'Pause to verify'}).click();
  await expect(page.getByRole('button',{name:'Resume call',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(checkin).toHaveCount(0);
  await page.getByRole('button',{name:'Practice again',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  await expect(checkin).toHaveCount(0);
  provider.say('I feel sad again.','user');
  await expect(checkin).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.spokenCheckins.length)).toBe(2);
});

test('verified caller suppresses a check-in until grounded warning signs appear',async({page},testInfo)=>{
  const provider=await setup(page);
  await page.getByLabel('Caller verification',{exact:true}).selectOption('trusted');
  await page.getByRole('button',{name:'Start practice call',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  await expect(page.getByLabel('Caller verification',{exact:true})).toBeDisabled();
  provider.say('I feel sad today.','user');
  await expect(page.getByRole('region',{name:'Emotion cues'})).toContainText('Possible emotion: sadness');
  await expect(page.getByRole('region',{name:'Emotional check-in'})).toHaveCount(0);
  provider.say('Send your password now.','contact');
  const dialog=page.getByRole('dialog',{name:'Pause and verify this caller.'});
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('You may be feeling sad.');
  await page.screenshot({path:testInfo.outputPath('emotion-high-risk.png'),fullPage:true});
  await dialog.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(page.getByLabel('Caller verification',{exact:true})).toHaveValue('unknown');
});

test('mixed microphone speech never becomes a personal emotion inference',async({page})=>{
  const provider=await setup(page);
  await page.getByLabel('Audio source').selectOption('microphone');
  await page.getByRole('button',{name:'Start listening',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  provider.say('I feel sad and lonely today.');
  await expect(page.getByRole('log')).toContainText('I feel sad and lonely today.');
  await expect(page.getByRole('region',{name:'Emotion cues'})).toContainText('Mixed microphone audio cannot reliably identify your speech.');
  await expect(page.getByRole('region',{name:'Emotional check-in'})).toHaveCount(0);
});
