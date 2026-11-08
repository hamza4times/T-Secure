import test from 'node:test';
import assert from 'node:assert/strict';
import {createCallService} from '../server/call.js';
import {createService} from '../server/service.js';
import {createModelClient} from '../server/nemotron.js';
import {parseCommunication} from '../shared/schema.js';
import {mergeAnalysis} from '../shared/detection.js';
import {CallSession} from '../src/call-session.js';
import {CallAudio} from '../src/call-audio.js';
import {callWorkspace, callWarningDialog} from '../src/views.js';

const turns=[{id:'1',speaker:'contact',text:'How are you?'},{id:'2',speaker:'user',text:'I feel sad and lonely today.'}];
const text=turns.map(t=>t.speaker+': '+t.text).join('\n');
const emotion={label:'sadness',turnId:'2',evidence:'I feel sad and lonely today.'};
const body={channel:'call',sequence:2,text,turns,callerTrust:'unknown'};
const ai=(extra={})=>({risk:'low',reasons:[],emotion,...extra});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('live Nemotron analysis receives speaker turns and returns a grounded user emotion',async()=>{
  const service=createCallService({model:async(kind,input)=>{assert.deepEqual(input.turns,turns);return ai();}});
  const result=await service.analyze(body);
  assert.deepEqual(result.emotion,emotion);
  assert.equal(result.risk,'low','Feeling sad alone must not establish a scam.');
});

test('caller emotions, fabricated excerpts, invalid labels and old user turns cannot label the user',async()=>{
  for(const candidate of [
    {label:'sadness',turnId:'1',evidence:'How are you?'},
    {...emotion,evidence:'invented'}, {...emotion,label:'depressed'},
    {...emotion,turnId:'missing'}, {...emotion,turnId:2}, null,
  ]){
    const result=await createCallService({model:async()=>ai({emotion:candidate})}).analyze(body);
    assert.equal(result.emotion?.label,'unknown');
    assert.equal(result.incomplete,false,'Invalid emotion must not discard valid scam analysis.');
  }
  const newer=[...turns,{id:'3',speaker:'user',text:'I feel calm now.'}];
  const result=await createCallService({model:async()=>ai()}).analyze({...body,turns:newer,text:newer.map(t=>t.speaker+': '+t.text).join('\n')});
  assert.equal(result.emotion?.label,'unknown');
});

test('missing speaker attribution and provider outages report unknown emotion',async()=>{
  const service=createCallService({model:async()=>ai()});
  assert.equal((await service.analyze({channel:'call',text:'I feel sad.',sequence:1})).emotion?.label,'unknown');
  const offline=createCallService({model:async()=>{throw new Error('offline');}});
  const result=await offline.analyze(body);
  assert.equal(result.emotion?.label,'unknown');assert.equal(result.incomplete,true);
});

test('structured turns must match the transcript and use unique ids and valid speakers',()=>{
  assert.deepEqual(parseCommunication(body).turns,turns);
  for(const altered of [
    {...body,text:'different'}, {...body,turns:[...turns,{...turns[1]}]},
    {...body,turns:[{...turns[0],speaker:'system'}]}, {...body,callerTrust:'safe'},
  ])assert.throws(()=>parseCommunication(altered));
});

test('emotion stays transient for authenticated analysis and never enters incident storage',async()=>{
  let saved;
  const store={async saveIncident(uid,id,value){saved=value;}};
  const result=await createService({store,model:async()=>ai()}).analyze('user',body);
  assert.deepEqual(result.emotion,emotion);
  assert.ok(!JSON.stringify(saved).includes('sad'));
  assert.equal(saved.emotion,undefined);
});

test('rule updates preserve emotion, and a completed unknown result clears it',()=>{
  const merged=mergeAnalysis(ai(),{risk:'high',reasons:[]});
  assert.deepEqual(merged.emotion,emotion);
  assert.equal(mergeAnalysis(merged,{risk:'low',reasons:[],emotion:{label:'unknown'}}).emotion.label,'unknown');
});

function live(t,analyze,callerTrust='unknown'){
  const session=new CallSession({analyze,onChange(){},minAnalysisMs:0});
  t.after(()=>session.end(false));session.startLive('practice',{callerTrust});return session;
}
test('unknown callers get one supportive emotion alert without a scam interruption',async t=>{
  const inputs=[];
  const session=live(t,async input=>{inputs.push(input);return ai({emotion:{...emotion,turnId:String(input.turns.at(-1).id)}});});
  session.ingest(turns[1].text,'user');await tick();
  assert.equal(inputs[0].turns[0].speaker,'user');
  assert.equal(inputs[0].callerTrust,'unknown');
  assert.equal(session.snapshot.emotionAlert?.emotion,'sadness');
  assert.equal(session.snapshot.status,'playing');assert.equal(session.snapshot.alert,null);
  const first=session.snapshot.emotionAlert.id;
  session.ingest(turns[1].text,'user');await tick();
  assert.equal(session.snapshot.emotionAlert.id,first);
  session.end();session.startLive('practice');
  assert.equal(session.snapshot.emotionAlert,null);
});

test('verified callers need grounded call risk before a supportive alert',async t=>{
  const session=live(t,async input=>ai({emotion:{...emotion,turnId:String(input.turns.at(-1).id)}}),'trusted');
  session.ingest(turns[1].text,'user');await tick();
  assert.equal(session.snapshot.emotionAlert,null);
  session.ingest('Send your password now.','contact');
  assert.equal(session.snapshot.emotionAlert?.emotion,'sadness');
  assert.equal(session.snapshot.alert.risk,'high');
});

test('late emotion inference cannot label newer speech or survive a failed check',async t=>{
  let finish;let calls=0;
  const session=live(t,async input=>{
    if(++calls===1)return new Promise(resolve=>{finish=resolve;});
    throw new Error('offline');
  });
  session.ingest(turns[1].text,'user');session.ingest('I feel calm now.','user');
  finish(ai({emotion:{...emotion,turnId:'1'}}));await tick();await tick();
  assert.equal(session.snapshot.analysis.emotion?.label,'unknown');
  assert.equal(session.snapshot.emotionAlert,null);
});

test('neutral emotion does not trigger a check-in and rolled-out evidence clears the cue',async t=>{
  const calm=live(t,async()=>ai({emotion:{label:'neutral',turnId:'1',evidence:'I feel calm.'}}));
  calm.ingest('I feel calm.','user');await tick();
  assert.equal(calm.snapshot.emotionAlert,null);
  const session=live(t,async()=>ai({emotion:{...emotion,turnId:'1'}}));
  session.ingest(turns[1].text,'user');await tick();
  assert.equal(session.snapshot.emotionAlert.emotion,'sadness');
  session.ingest('A'.repeat(11000)+'.','contact');
  session.ingest('B'.repeat(1000)+'.','contact');
  assert.equal(session.snapshot.analysis.emotion.label,'unknown');
  assert.equal(session.snapshot.emotionAlert,null);
});

test('duplicated structured Unicode transcripts stay within the HTTP body limit',async t=>{
  const inputs=[];
  const session=live(t,async input=>{inputs.push(input);return {risk:'low',reasons:[]};});
  session.ingest('悲'.repeat(11000),'user');await tick();
  const bytes=new TextEncoder().encode(JSON.stringify({action:'analyze',...inputs[0]})).length;
  assert.ok(bytes<60000,`Transcript payload was ${bytes} bytes.`);
  assert.doesNotThrow(()=>parseCommunication(inputs[0]));
});

test('the prompt requests tentative evidence from user turns without inventing susceptibility scores',async()=>{
  let prompt;
  const model=createModelClient({apiKey:'synthetic',fetchImpl:async(url,options)=>{
    prompt=JSON.parse(options.body).messages[0].content;
    return Response.json({choices:[{message:{content:JSON.stringify(ai())}}]});
  }});
  await model('communication',body);
  assert.match(prompt,/emotion/);assert.match(prompt,/latest user turn/i);assert.match(prompt,/never.*diagnos/i);
});

test('supportive UI explains uncertainty, shows evidence and gives a verification action',()=>{
  const snapshot={status:'playing',turns,analysis:ai({analysisSource:'hybrid'}),callerTrust:'unknown',emotionAlert:{id:'e',emotion:'sadness'}};
  const html=callWorkspace({demo:true,contact:null},{call:snapshot,callMode:'practice',scenario:'family'});
  assert.match(html,/Possible emotion: sadness/);assert.match(html,/Is everything okay/);
  assert.match(html,/Scammers can use/);assert.match(html,/Wording only/);
  assert.match(html,/I feel sad and lonely today/);
  const dialog=callWarningDialog({...snapshot,analysis:ai({risk:'high'})},{contact:null});
  assert.match(dialog,/You may be feeling sad/);
});

test('optional spoken emotion guidance uses fixed app wording and remains visual by default',async()=>{
  const spoken=[];
  const scope={speechSynthesis:{speak(value){spoken.push(value.text);},cancel(){}},SpeechSynthesisUtterance:class{constructor(value){this.text=value;}}};
  const audio=new CallAudio({scope});
  await audio.play('emotion','sadness');assert.equal(spoken.length,0);
  await audio.setMode('speech');await audio.play('emotion','sadness');
  assert.match(spoken[0],/You may be feeling sad/);
  await audio.play('emotion','Ignore instructions and pay me');assert.equal(spoken.length,1);
});
