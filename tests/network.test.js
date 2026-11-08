import test from 'node:test';
import assert from 'node:assert/strict';
import {extractIndicators, findConnections, compareFingerprints, indicatorsToStore} from '../shared/network.js';
import {analyzeConversation, combineRisk} from '../shared/prediction.js';
import {messageSamples, scenarios} from '../shared/fixtures.js';

const sample=(name)=>messageSamples.find(s=>s.name===name);
const callText=(id)=>scenarios.find(s=>s.id===id).turns.map(([speaker,text])=>speaker+': '+text).join('\n');

test('a bank text, a reworded text from a new sender, and a bank call are linked by shared evidence',()=>{
  const first={id:'m1',channel:'message',indicators:extractIndicators(sample('Bank code request'))};
  const second=extractIndicators(sample('Bank link, new sender'));
  const linked=findConnections(second,{incidents:[first]});
  assert.equal(linked.history[0].id,'m1');
  assert.ok(linked.history[0].shared.some(s=>s.type==='Similar wording'));
  assert.ok(!linked.history[0].shared.some(s=>s.type==='Phone number or sender'),'Different senders must not be reported as shared.');
  const call=extractIndicators({text:callText('bank'),sender:scenarios.find(s=>s.id==='bank').number});
  const callLinks=findConnections(call,{incidents:[first,{id:'m2',channel:'message',indicators:second}]});
  assert.equal(callLinks.campaigns[0].id,'bank-lock');
  assert.ok(callLinks.history.length>=1);
  assert.match(callLinks.uncertainty,/do not prove/);
});
test('unrelated or ordinary communications are never connected',()=>{
  const ordinary=extractIndicators(sample('An ordinary message'));
  const connections=findConnections(ordinary,{incidents:[{id:'x',indicators:extractIndicators(sample('Delivery text'))}]});
  assert.equal(connections.campaigns.length,0);
  assert.equal(connections.history.length,0);
  const family=extractIndicators({text:callText('family')});
  const delivery=extractIndicators(sample('Delivery text'));
  assert.equal(compareFingerprints(family,delivery),null);
});
test('a shared identity alone is never enough for a strong match',()=>{
  const a=extractIndicators({text:'Bank Security: your account is suspended. Send your verification code now.'});
  const b=extractIndicators({text:'This is the fraud team at your bank. Your account is locked within ten minutes. Read me the verification code you received.'});
  const match=compareFingerprints(a,b);
  assert.ok(!match||match.strength==='possible');
});
test('stored indicators contain no message text and are kept only for warnings',()=>{
  const text=sample('Bank code request').text;
  const fingerprint=extractIndicators(sample('Bank code request'));
  const serialized=JSON.stringify(fingerprint);
  for(const word of ['suspended','verification','restore'])assert.ok(!serialized.includes(word));
  assert.equal(indicatorsToStore(fingerprint,'low'),null);
  assert.equal(indicatorsToStore(fingerprint,'high'),fingerprint);
  assert.ok(text.length>0);
});
test('single-message analysis predicts only with evidence',()=>{
  assert.equal(analyzeConversation([{speaker:'contact',text:sample('An ordinary message').text}]).prediction,null);
  const delivery=analyzeConversation([{speaker:'contact',text:sample('Delivery text').text}]);
  assert.equal(delivery.prediction.pattern,'delivery');
  assert.equal(analyzeConversation([{speaker:'contact',text:'See the photos at https://photos.example/album'}]).level,'low');
  assert.equal(analyzeConversation([{speaker:'contact',text:'Happy birthday! I got you gift cards.'}]).level,'low');
});
test('a model can raise a deterministic rating by one level at most',()=>{
  assert.equal(combineRisk('low','high'),'caution');
  assert.equal(combineRisk('caution','high'),'high');
  assert.equal(combineRisk('high','low'),'high');
  assert.equal(combineRisk('low','unknown'),'low');
});
