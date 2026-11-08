import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeConversation} from '../shared/prediction.js';
import {scenarios} from '../shared/fixtures.js';
import {CallSession} from '../src/call-session.js';

const turnsOf=(id)=>scenarios.find(s=>s.id===id).turns.map(([speaker,text])=>({speaker,text}));
function firstTurn(turns,check){
  for(let n=1;n<=turns.length;n++)if(check(analyzeConversation(turns.slice(0,n))))return n;
  return null;
}

test('scam scenarios are predicted before the harmful request is made',()=>{
  for(const id of ['family','grandchild','bank','government','support']){
    const turns=turnsOf(id);
    const predicted=firstTurn(turns,r=>r.prediction&&r.prediction.strength!=='possible');
    const requested=firstTurn(turns,r=>r.prediction?.confirmed);
    assert.ok(predicted&&requested,id+' should be predicted and confirmed');
    assert.ok(predicted<requested,`${id}: predicted at ${predicted}, requested at ${requested}`);
  }
});
test('family emergency escalates to high before any money request',()=>{
  const turns=turnsOf('grandchild').slice(0,3);
  const result=analyzeConversation(turns);
  assert.equal(result.level,'high');
  assert.equal(result.requests.length,0);
  assert.equal(result.prediction.pattern,'family');
  assert.deepEqual(new Set(result.findings.map(f=>f.tactic)),new Set(['trust','verification','fear','secrecy']));
});
test('every finding quotes the transcript exactly and carries uncertainty',()=>{
  const turns=turnsOf('bank');
  const result=analyzeConversation(turns);
  for(const f of result.findings){
    assert.ok(turns[f.turn-1].text.includes(f.excerpt));
    assert.ok(['low','medium','high'].includes(f.confidence));
  }
  assert.match(result.prediction.uncertainty,/not a certainty/);
});
test('ordinary conversations, single urgency words, and user replies stay quiet',()=>{
  assert.equal(analyzeConversation(turnsOf('legitimate')).level,'low');
  assert.equal(analyzeConversation([{speaker:'contact',text:'Keep the surprise party secret until Saturday.'}]).level,'low');
  assert.equal(analyzeConversation([{speaker:'contact',text:'Can you call me back now?'}]).level,'low');
  assert.equal(analyzeConversation([{speaker:'user',text:'Do not tell anyone, I will buy gift cards right away.'}]).level,'low');
  assert.equal(analyzeConversation([{speaker:'contact',text:'Never share your verification code with anyone.'}]).requests.length,0);
});
test('a predictive high warning pauses the call once and records when it was predicted',t=>{
  const session=new CallSession({analyze:async()=>({risk:'low',reasons:[]}),onChange:()=>{},intervalMs:60000,minAnalysisMs:60000});
  t.after(()=>session.end(false));
  session.start(scenarios.find(s=>s.id==='grandchild'));
  assert.equal(session.snapshot.alert?.risk,'caution');
  assert.equal(session.snapshot.status,'playing');
  assert.equal(session.snapshot.predictedAt.turn,1);
  session.advance();session.advance();
  assert.equal(session.snapshot.alert.risk,'high');
  assert.equal(session.snapshot.alert.predictive,true);
  assert.equal(session.snapshot.status,'paused');
  session.resume();session.advance();session.advance();
  assert.equal(session.snapshot.status,'playing');
  assert.equal(session.snapshot.insight.prediction.confirmed.turn,5);
});
