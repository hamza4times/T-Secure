import test from 'node:test';
import assert from 'node:assert/strict';
import { requireVerified } from '../server/auth.js';
import { createService } from '../server/service.js';
import { CallSession } from '../src/call-session.js';
import { getHistory } from '../shared/fixtures.js';

function makeStore() {
  const state = {enabled:true,revision:1,assessment:null,sessions:new Map(),historySetId:'pressure'};
  return {
    state,
    async getConsent() { return {enabled:state.enabled,revision:state.revision,historySetId:state.historySetId}; },
    async setConsent(uid, enabled, historySetId) { state.enabled=enabled;state.historySetId=historySetId;state.revision++;state.assessment=null;return this.getConsent(); },
    async commitAssessment(uid, revision, assessment) { if (!state.enabled || revision !== state.revision) return false; state.assessment=assessment;return true; },
    async getAssessment() { return state.assessment; },
    async clearAssessment() { state.revision++;state.assessment=null; },
    async saveIncident(uid, id, data) { const key=uid+':'+id;const previous=state.sessions.get(key); if (!previous || previous.sequence < data.sequence) state.sessions.set(key,data); },
    async getIncident(uid,id) { return state.sessions.get(uid+':'+id); },
    async takeRateLimit() { return true; },
  };
}
test('unauthenticated requests and unverified identities are rejected', async () => {
  await assert.rejects(requireVerified({}, async () => ({})), /sign in/i);
  await assert.rejects(requireVerified({authorization:'Bearer token'},async () => ({uid:'a',email_verified:false})), /verify/i);
  assert.equal((await requireVerified({authorization:'Bearer token'},async () => ({uid:'a',email_verified:true}))).uid, 'a');
});
test('expired and revoked tokens are rejected without leaking provider errors', async () => {
  await assert.rejects(requireVerified({authorization:'Bearer old'},async () => {throw new Error('sensitive provider detail');}), (e) => e.status === 401 && !e.message.includes('sensitive'));
});
test('analysis never persists raw submitted text or evidence excerpts', async () => {
  const store=makeStore();
  const service=createService({store,model:async () => {throw new Error('offline');}});
  const result=await service.analyze('a',{channel:'message',sequence:1,text:'Please send your verification code 123456.'});
  assert.equal(result.risk,'high');
  assert.equal(result.analysisSource,'rules-only');
  const persisted=JSON.stringify([...store.state.sessions.values()]);
  assert.ok(!persisted.includes('123456'));
  assert.ok(!persisted.includes('Please send'));
});
test('a session id cannot expose or overwrite another user incident', async () => {
  const store=makeStore();
  const service=createService({store,model:async () => ({risk:'low',reasons:[]})});
  const a=await service.analyze('a',{channel:'message',sequence:1,text:'Hello'});
  await assert.rejects(service.analyze('b',{sessionId:a.sessionId,channel:'message',sequence:2,text:'Hello'}), (e) => e.status === 404);
});
test('invalid communication is rejected as a client error', async () => {
  const service=createService({store:makeStore(),model:async()=>({risk:'low',reasons:[]})});
  await assert.rejects(service.analyze('a',{channel:'message',text:'',sequence:1}),(e)=>e.status===400);
});
test('deleting an assessment invalidates an in-flight analysis without disabling standard protection', async () => {
  const store=makeStore();
  let finish;
  const service=createService({store,model:()=>new Promise((resolve)=>{finish=resolve;})});
  const pending=service.assess('a',{historySetId:'pressure'});
  while(!finish)await new Promise((r)=>setImmediate(r));
  await service.deleteAssessment('a');
  finish({opportunities:getHistory('pressure').expected});
  await assert.rejects(pending,(e)=>e.status===409);
  assert.equal(store.state.assessment,null);
  assert.equal(store.state.enabled,true);
});
test('consent disabled while model is working prevents late profile restoration', async () => {
  const store=makeStore();
  let resolveModel;
  const service=createService({store,model:() => new Promise((resolve) => {resolveModel=resolve;})});
  const pending=service.assess('a',{historySetId:'pressure'});
  while (!resolveModel) await new Promise((r) => setImmediate(r));
  await service.setConsent('a',{enabled:false,historySetId:'pressure'});
  resolveModel({opportunities:getHistory('pressure').expected});
  await assert.rejects(pending,(e) => e.status === 409);
  assert.equal(store.state.assessment,null);
});
test('profile analysis requires affirmative consent and allows only sample histories', async () => {
  const store=makeStore();
  const service=createService({store,model:async () => ({opportunities:[]})});
  store.state.enabled=false;
  await assert.rejects(service.assess('a',{historySetId:'pressure'}), (e) => e.status === 403);
  store.state.enabled=true;
  await assert.rejects(service.assess('a',{historySetId:'user-upload'}));
});
test('profile is calculated from extracted evidence and contains no raw turns', async () => {
  const store=makeStore();
  const service=createService({store,model:async () => ({opportunities:getHistory('pressure').expected})});
  const result=await service.assess('a',{historySetId:'pressure'});
  assert.equal(result.score,83);
  assert.equal(result.coverage.assessable,6);
  assert.equal(result.analysisSource,'hybrid');
  assert.ok(!JSON.stringify(store.state.assessment).includes('gift cards now'));
});
test('simulated call rejects a response arriving after it was ended', async () => {
  let resolveAnalysis;
  const snapshots=[];
  const session=new CallSession({analyze:() => new Promise((resolve)=>{resolveAnalysis=resolve;}),onChange:(snapshot)=>snapshots.push(snapshot),intervalMs:10,minAnalysisMs:0});
  session.start({id:'test',turns:[['contact','Please send your verification code.'],['user','No.']]});
  session.end();
  resolveAnalysis({risk:'high',reasons:[],analysisSource:'hybrid'});
  await new Promise((resolve)=>setTimeout(resolve,25));
  assert.equal(snapshots.at(-1).status,'ended');
  assert.equal(snapshots.at(-1).turns.length,1);
});
test('pause freezes transcript and high warnings persist after resume', async () => {
  const session=new CallSession({analyze:async () => ({risk:'low',reasons:[]}),onChange:()=>{},intervalMs:15,minAnalysisMs:3000});
  session.start({id:'test',turns:[['contact','Send your password.'],['contact','Hello again.'],['contact','Goodbye.']]});
  session.pause();
  const count=session.snapshot.turns.length;
  await new Promise((resolve)=>setTimeout(resolve,35));
  assert.equal(session.snapshot.turns.length,count);
  session.resume();
  await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(session.snapshot.analysis.risk,'high');
  session.end();
});
test('unavailable call backend is backed off instead of requested on every turn',async()=>{
  let calls=0;
  const session=new CallSession({
    analyze:async()=>{calls++;throw Object.assign(new Error('Unavailable'),{status:503,retryAfterMs:30000});},
    onChange:()=>{},intervalMs:10,minAnalysisMs:0,
  });
  session.start({id:'offline',turns:[['contact','Hello'],['contact','Send your password.'],['contact','Goodbye']]});
  await new Promise(resolve=>setTimeout(resolve,55));
  session.end();
  assert.equal(calls,1);
  assert.equal(session.snapshot.analysis.risk,'high');
  assert.equal(session.snapshot.analysis.incomplete,true);
});
