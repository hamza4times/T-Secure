import test from 'node:test';
import assert from 'node:assert/strict';
import {CallSession} from '../src/call-session.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('live sessions wait for real transcripts and analyze at most two sentences per turn',async t=>{
  const inputs=[];
  const session=new CallSession({analyze:async input=>{inputs.push(input);return {risk:'low',reasons:[],analysisSource:'hybrid'};},onChange(){},minAnalysisMs:0});
  t.after(()=>session.end(false));
  assert.equal(typeof session.startLive,'function','Live audio must have an ingestion path.');
  session.startLive('microphone');
  assert.equal(session.snapshot.turns.length,0);
  session.ingest('Hello there. We noticed activity. Please check your account.', 'contact');
  await tick();
  assert.equal(session.snapshot.turns.length,2);
  assert.equal(session.snapshot.turns[0].text,'Hello there. We noticed activity.');
  assert.equal(inputs.at(-1).source,'live-audio');
  assert.equal(session.snapshot.analysis.risk,'low','A completed benign model check clears the initial unknown state.');
  assert.match(inputs.at(-1).text,/Please check your account/);
  session.pause();session.ingest('This must not be captured.','contact');
  assert.equal(session.snapshot.turns.length,2);
});

test('a model result for an earlier live segment still warns while new speech arrives',async t=>{
  let resolveFirst;
  let calls=0;
  const session=new CallSession({analyze:async()=>{
    if(++calls===1)return new Promise(resolve=>{resolveFirst=resolve;});
    return {risk:'low',reasons:[],analysisSource:'hybrid'};
  },onChange(){},minAnalysisMs:0});
  t.after(()=>session.end(false));
  assert.equal(typeof session.startLive,'function');
  session.startLive('microphone');
  session.ingest('Move your savings to the vault I control.','contact');
  session.ingest('Are you there?','contact');
  resolveFirst({risk:'high',reasons:[{code:'authority',evidence:'Move your savings to the vault I control.'}],analysisSource:'hybrid'});
  await tick();
  assert.equal(session.snapshot.alert?.risk,'high');
  assert.equal(calls,2,'Speech received during analysis must not be dropped.');
});

test('ending live audio prevents pending transcripts and model results from reopening alerts',async t=>{
  let finish;
  const session=new CallSession({analyze:()=>new Promise(resolve=>{finish=resolve;}),onChange(){},minAnalysisMs:0});
  t.after(()=>session.end(false));
  assert.equal(typeof session.startLive,'function');
  session.startLive('microphone');session.ingest('Hello.','contact');session.end();
  session.ingest('Send your password.','contact');
  finish({risk:'high',reasons:[{code:'credentials',evidence:'Hello.'}]});await tick();
  assert.equal(session.snapshot.status,'ended');
  assert.equal(session.snapshot.alert,null);
  assert.equal(session.snapshot.turns.length,1);
});

test('fast speech queues each pair of sentences while a previous inference is in flight',async t=>{
  const inputs=[];let finish;
  const session=new CallSession({analyze:async input=>{inputs.push(input);if(inputs.length===1)await new Promise(resolve=>{finish=resolve;});return {risk:'low',reasons:[],analysisSource:'hybrid'};},onChange(){},minAnalysisMs:0});
  t.after(()=>session.end(false));session.startLive();
  session.ingest('One. Two. Three. Four. Five. Six.');
  finish();await tick();await tick();
  assert.equal(inputs.length,3);
  assert.deepEqual(inputs.map(input=>input.sequence),[1,2,3]);
  assert.equal(inputs[1].text,'contact: One. Two.\ncontact: Three. Four.');
});
