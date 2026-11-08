import {test,expect} from '@playwright/test';
import {callFixture} from './call-fixture.js';

test('practice transcribes actual PCM, sends speech to Nemotron, and generates a reply to the user',async({page},testInfo)=>{
  const provider=await callFixture(page);await page.goto('/#/calls');
  await page.getByRole('button',{name:'Start practice call',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  const transcript=page.getByRole('log',{name:'Live conversation transcript'});
  await expect(transcript).not.toContainText('A newly generated caller reply.');
  await expect.poll(()=>provider.pcmFrames.length).toBeGreaterThan(0);
  await expect.poll(()=>provider.pcmFrames.some(frame=>Buffer.from(frame,'base64').some(byte=>byte!==0))).toBe(true);
  provider.say('Hello there. How are you?');
  await expect(transcript).toContainText('Hello there. How are you?');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/qa/live-audio-'+testInfo.project.name+'.png',fullPage:true});
  await expect.poll(()=>provider.requests.filter(body=>body.action==='analyze').length).toBe(1);
  expect(provider.requests.find(body=>body.action==='analyze')).toMatchObject({source:'live-audio',sequence:1,text:'contact: Hello there. How are you?'});
  provider.say('I will call my bank first.','user');
  await expect.poll(()=>provider.requests.filter(body=>body.action==='reply').length).toBe(2);
  expect(provider.requests.filter(body=>body.action==='reply').at(-1).turns).toContainEqual({speaker:'user',text:'I will call my bank first.'});
  await page.getByRole('button',{name:'End demo call',exact:true}).click();
  await expect(page.getByText('Call ended',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.capturedAudioTracks.length>0&&window.capturedAudioTracks.every(track=>track.readyState==='ended'))).toBe(true);
});

test('microphone monitoring reports high-risk speech and releases capture when navigating away',async({page})=>{
  const provider=await callFixture(page);await page.goto('/#/calls');
  await page.getByLabel('Audio source').selectOption('microphone');
  await page.getByRole('button',{name:'Start listening',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();
  expect(provider.requests.some(body=>body.action==='reply'||body.action==='speech')).toBe(false);
  provider.say('Send your verification code now.');
  await expect(page.getByRole('dialog',{name:'Pause and verify this caller.'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/#/learn');
  await expect(page.getByRole('heading',{name:'Small habits. Stronger protection.'})).toBeVisible();
  expect(await page.evaluate(()=>window.capturedAudioTracks.every(track=>track.readyState==='ended'))).toBe(true);
  await page.goto('/#/calls');
  await expect(page.getByText('Call ended',{exact:true})).toBeVisible();
});

test('microphone denial is actionable and never starts a scripted conversation',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/#/calls');await page.getByRole('button',{name:'Start practice call',exact:true}).click();
  await expect(page.getByText(/Microphone permission was denied/).first()).toBeVisible();
  await expect(page.getByRole('log')).not.toContainText('Hi Grandma');
  await expect(page.getByText('Call ended',{exact:true})).toBeVisible();
});

test('transcription disconnect ends monitoring and exposes an actionable error',async({page})=>{
  const provider=await callFixture(page);await page.goto('/#/calls');
  await page.getByRole('button',{name:'Start practice call',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause call',exact:true})).toBeVisible();provider.disconnect();
  await expect(page.getByText(/Live transcription disconnected/).first()).toBeVisible();
  await expect(page.getByText('Call ended',{exact:true})).toBeVisible();
});
