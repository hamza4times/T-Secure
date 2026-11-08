// Acceptance scenarios for message analysis, prediction, and Scam Network Intelligence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConversation, maxLevel } from '../shared/prediction.js';
import { analyzeText } from '../shared/detection.js';
import { extractIndicators, findConnections } from '../shared/network.js';
import { createService } from '../server/service.js';

const assess=(text)=>{
  const insight=analyzeConversation([{speaker:'contact',text}]);
  return {...insight,risk:maxLevel(analyzeText(text).risk,insight.level)};
};
function memoryStore({failWrites=false}={}) {
  const sessions=new Map();
  return {sessions,
    async saveIncident(uid,id,data){if(failWrites)throw new Error('unavailable');sessions.set(uid+':'+id,data);},
    async getIncident(uid,id){return sessions.get(uid+':'+id);},
  };
}

test('bank impersonation: urgent suspension with a link is high risk and predicts a code or transfer request',()=>{
  const result=assess('Your bank account will be suspended today. Click the link to verify your identity: https://secure-bank-verify.example/login');
  assert.equal(result.risk,'high');
  assert.equal(result.prediction.pattern,'bank');
  assert.ok(result.requests.some(r=>r.code==='link'));
  assert.ok(result.findings.some(f=>f.tactic==='fear'));
});
test('family emergency: impersonation, emergency, money, and secrecy are all evidenced',()=>{
  const result=assess('Mom, it’s me. I lost my phone and this is my new number. I’m in trouble and need $500 for a lawyer right away. Please don’t tell Dad.');
  assert.equal(result.risk,'high');
  assert.equal(result.prediction.pattern,'family');
  for(const tactic of ['trust','fear','urgency','secrecy','verification'])assert.ok(result.findings.some(f=>f.tactic===tactic),tactic);
  assert.ok(result.requests.some(r=>r.code==='payment'));
});
test('verification code scam: a one-time code request is high risk with a code-theft prediction',()=>{
  const result=assess('We stopped an unauthorized transfer from your account. Reply with the 6-digit code we just sent you to cancel it.');
  assert.equal(result.risk,'high');
  assert.equal(result.prediction.pattern,'credentials');
  assert.match(result.prediction.followUp,/sign in|transfer/);
});
test('legitimate urgent message: a genuine deadline is not classified as a scam',()=>{
  for(const text of [
    'Reminder: your prescription is ready and will be returned to stock if not picked up by 6pm today. Questions? Call the number on your prescription label.',
    'Your flight boards in 30 minutes at gate 12. Please head to the gate now.',
  ]){
    const result=assess(text);
    assert.equal(result.risk,'low',text);
    assert.equal(result.prediction,null,text);
  }
});
test('insufficient evidence: vague messages produce no prediction',()=>{
  for(const text of ['Hey, it has been a while! Is this still your number?','Call me when you get a chance.','Your account']){
    const result=assess(text);
    assert.equal(result.prediction,null,text);
    assert.equal(result.risk,'low',text);
  }
});
test('related campaign: communications with shared indicators are correlated with explanations',()=>{
  const first={id:'a',channel:'message',updatedAt:new Date().toISOString(),indicators:extractIndicators({text:'Bank Security: Your account is suspended. Send your verification code to restore access.',sender:'+1 (555) 014-7731'})};
  const second=extractIndicators({text:'Bank Security: Your account is suspended. Verify now at https://secure-bank-verify.example/login to restore access.',sender:'+1 (555) 014-9902'});
  const connections=findConnections(second,{incidents:[first]});
  assert.equal(connections.campaigns[0].id,'bank-lock');
  assert.ok(connections.campaigns[0].shared.some(s=>s.type==='Website domain'));
  assert.equal(connections.history[0].id,'a');
  assert.ok(connections.history[0].shared.every(s=>s.type&&s.detail&&s.why));
});
test('unrelated communications: different scams without shared evidence are not grouped',()=>{
  const delivery={id:'d',indicators:extractIndicators({text:'Your delivery is on hold. Pay a small fee: https://redelivery-fee.example',sender:'+1 (555) 016-3318'})};
  const romance=extractIndicators({text:'My love, we have never met but you are all I have. Send gift cards and do not tell anyone.',sender:'+1 (555) 010-0001'});
  assert.equal(findConnections(romance,{incidents:[delivery]}).history.length,0);
  const genuine=extractIndicators({text:'Your flight boards in 30 minutes at gate 12.'});
  const all=findConnections(genuine,{incidents:[delivery]});
  assert.equal(all.campaigns.length+all.history.length,0);
});
test('an AI response alone cannot make an ordinary message high risk',async()=>{
  const text='See you at lunch tomorrow at noon.';
  const service=createService({store:memoryStore(),model:async()=>({risk:'high',reasons:[{code:'urgency',evidence:'lunch tomorrow'}]})});
  const result=await service.analyze('u',{channel:'message',sequence:1,text});
  assert.equal(result.risk,'caution');
});
test('provider outages fall back to deterministic analysis, and malformed AI output is rejected',async()=>{
  const text='Bank Security: Your account is suspended. Send your verification code to restore access.';
  for(const model of [async()=>{throw new Error('offline');},async()=>({risk:'high',reasons:[{code:'credentials',evidence:'not in the message'}]}),async()=>'garbage']){
    const result=await createService({store:memoryStore(),model}).analyze('u',{channel:'message',sequence:1,text});
    assert.equal(result.risk,'high');
    assert.equal(result.incomplete,true);
    assert.equal(result.analysisSource,'rules-only');
  }
});
test('a failed history write still returns the completed analysis',async()=>{
  const result=await createService({store:memoryStore({failWrites:true}),model:async()=>({risk:'low',reasons:[]})}).analyze('u',{channel:'message',sequence:1,text:'Send your verification code now.'});
  assert.equal(result.saved,false);
  assert.equal(result.sessionId,null);
  assert.equal(result.risk,'high');
});
test('malformed submissions are rejected with a clear error',async()=>{
  const service=createService({store:memoryStore(),model:async()=>({risk:'low',reasons:[]})});
  await assert.rejects(service.analyze('u',{channel:'message',sequence:1,text:''}),e=>e.status===400);
  await assert.rejects(service.analyze('u',{channel:'fax',sequence:1,text:'hi'}),e=>e.status===400);
  await assert.rejects(service.analyze('u',{channel:'message',sequence:1,text:'hi',sender:'x'.repeat(41)}),e=>e.status===400);
});
test('saved warnings keep derived indicators only',async()=>{
  const store=memoryStore();
  await createService({store,model:async()=>{throw new Error('offline');}}).analyze('u',{channel:'message',sequence:1,text:'Bank Security: Your account is suspended. Send your verification code to restore access.',sender:'+1 (555) 014-7731'});
  const saved=[...store.sessions.values()][0];
  assert.ok(saved.indicators);
  assert.ok(!JSON.stringify(saved).includes('suspended'));
});
