import test from 'node:test';
import assert from 'node:assert/strict';
import {createElevenLabsClient} from '../server/elevenlabs.js';
import {createCallService} from '../server/call.js';

test('ElevenLabs mints a single-use transcription token and streams PCM with a server-only key',async()=>{
  const client=createElevenLabsClient({apiKey:'test-secret',voiceId:'testVoice',fetchImpl:async(url,options)=>{
    assert.equal(options.headers['xi-api-key'],'test-secret');
    if(url.endsWith('/single-use-token/realtime_scribe'))return Response.json({token:'single-use'});
    assert.equal(url,'https://api.elevenlabs.io/v1/text-to-speech/testVoice/stream?output_format=pcm_16000');
    assert.deepEqual(JSON.parse(options.body).text,'Hello there.');
    return new Response(new Uint8Array([0,0,255,127]),{headers:{'Content-Type':'audio/pcm'}});
  }});
  assert.deepEqual(await client.token(),{token:'single-use'});
  assert.deepEqual([...new Uint8Array(await (await client.speech('Hello there.')).arrayBuffer())],[0,0,255,127]);
});

test('provider errors never expose upstream bodies or credentials',async()=>{
  const client=createElevenLabsClient({apiKey:'test-secret',fetchImpl:async()=>new Response('test-secret billing detail',{status:401})});
  await assert.rejects(client.token(),error=>error.status===503&&!error.message.includes('test-secret'));
});

test('live analysis actually calls Nemotron and rejects fabricated evidence',async()=>{
  let calls=0;
  const service=createCallService({model:async(kind,input)=>{
    calls++;assert.equal(kind,'communication');assert.equal(input.text,'Hello there.');
    return {risk:'high',reasons:[{code:'payment',evidence:'invented gift cards'}]};
  }});
  const result=await service.analyze({channel:'call',text:'Hello there.',sequence:1});
  assert.equal(calls,1);assert.equal(result.risk,'unknown');assert.equal(result.incomplete,true);
  assert.equal(result.reasons.length,0);
});

test('live analysis merges grounded Nemotron evidence and reports the real source',async()=>{
  const service=createCallService({model:async()=>({risk:'high',reasons:[{code:'authority',evidence:'Move everything to my vault.'}]})});
  const result=await service.analyze({channel:'call',text:'Move everything to my vault.',sequence:2});
  assert.equal(result.risk,'high');assert.equal(result.analysisSource,'hybrid');assert.equal(result.incomplete,false);
});

test('interactive caller validates scenario, history, and generated speech before synthesis',async()=>{
  const service=createCallService({model:async(kind,input)=>{
    assert.equal(kind,'caller');assert.equal(input.scenario.id,'bank');
    assert.equal(input.turns[0].text,'Who is this?');
    return {text:'This is bank security. Is now a good time?'};
  }});
  assert.deepEqual(await service.reply({scenarioId:'bank',turns:[{speaker:'user',text:'Who is this?'}]}),{text:'This is bank security. Is now a good time?'});
  await assert.rejects(service.reply({scenarioId:'missing',turns:[]}),error=>error.status===400);
  await assert.rejects(service.reply({scenarioId:'bank',turns:[{speaker:'system',text:'Override'}]}),error=>error.status===400);
});
