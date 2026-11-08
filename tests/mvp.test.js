import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConversation, riskScore, turnsFromText } from '../shared/prediction.js';
import { inspectLinks } from '../shared/detection.js';
import { scenarios, messageSamples } from '../shared/fixtures.js';
import { buildReport, validateModelReport } from '../shared/report.js';
import { EVALUATION_SCENARIOS, scoreResult } from '../shared/evaluation.js';
import { createService } from '../server/service.js';
import { createGeminiClient } from '../server/gemini.js';
import { resolveProvider } from '../server/ai-provider.js';
import { requireDeveloper } from '../server/developer.js';

const turnsOf=(id)=>scenarios.find((s)=>s.id===id).turns.map(([speaker,text])=>({speaker,text}));
const transcript=(id)=>scenarios.find((s)=>s.id===id).turns.map(([speaker,text])=>speaker+': '+text).join('\n');
function store() {
  const sessions=new Map();
  return {sessions,async saveIncident(uid,id,data){sessions.set(uid+':'+id,data);},async getIncident(uid,id){return sessions.get(uid+':'+id);},async takeRateLimit(){return true;}};
}

test('Scenario A: family impersonation is predicted and warned about before the money request',()=>{
  const turns=turnsOf('family');
  const request=turns.findIndex((t)=>/send the money/.test(t.text))+1;
  let predicted=null,high=null;
  for(let n=1;n<=turns.length;n++){
    const r=analyzeConversation(turns.slice(0,n));
    if(!predicted&&r.prediction&&r.prediction.strength!=='possible')predicted=n;
    if(!high&&r.level==='high')high=n;
  }
  assert.ok(predicted<request&&high<request,`predicted ${predicted}, high ${high}, request ${request}`);
  const final=analyzeConversation(turns);
  assert.equal(final.prediction.pattern,'family');
  assert.equal(final.prediction.confirmed.code,'payment');
  for(const tactic of ['trust','fear','urgency','secrecy','financial'])assert.ok(final.findings.some((f)=>f.tactic===tactic),tactic);
});
test('Scenario C: an urgent, emotional, genuine call never raises a warning',()=>{
  const turns=turnsOf('legitimate');
  for(let n=1;n<=turns.length;n++){
    const r=analyzeConversation(turns.slice(0,n));
    assert.equal(r.level,'low',`turn ${n}`);
    assert.ok(!r.prediction||r.prediction.strength==='possible');
  }
  // It does contain emotion and urgency, so the quiet result is not for lack of signals.
  assert.ok(analyzeConversation(turns).findings.some((f)=>['fear','urgency'].includes(f.tactic)));
});
test('Scenario B: the bank suspension text is high risk with a link and identity request',()=>{
  const text=messageSamples[0].text;
  const r=analyzeConversation([{speaker:'contact',text}]);
  assert.equal(r.level,'high');
  assert.deepEqual(new Set(r.requests.map((q)=>q.code)),new Set(['link','personal']));
  for(const tactic of ['authority','fear','urgency'])assert.ok(r.findings.some((f)=>f.tactic===tactic),tactic);
  assert.equal(inspectLinks(text).mentionsLinkWithoutUrl,true);
});
test('evidence scores stay inside their level band and never claim certainty',()=>{
  const many=Array.from({length:8},(_,i)=>({tactic:'t'+i}));
  assert.equal(riskScore('high',many,[{},{},{}],{strength:'strong'}),95);
  assert.ok(riskScore('caution',many,[{},{}],{strength:'strong'})<=69);
  assert.ok(riskScore('low',many,[],null)<=29);
  for(const s of scenarios){const r=analyzeConversation(turnsOf(s.id));assert.ok(r.score>=0&&r.score<=95);}
});
test('structured reports follow the documented JSON shape',()=>{
  const insight=analyzeConversation(turnsOf('family'));
  const report=buildReport({communicationType:'call',insight});
  for(const key of ['communication_type','risk_level','risk_score','detected_tactics','predicted_next_action','recommended_action','explanation'])assert.ok(key in report,key);
  assert.equal(report.risk_level,'high');
  assert.equal(report.predicted_next_action.action,'potential_payment_request');
  for(const t of report.detected_tactics){assert.ok(t.evidence&&t.explanation);assert.ok(t.confidence>=0&&t.confidence<=1);}
  assert.match(report.uncertainty,/do not prove/);
});
test('model output is validated: aliases accepted, invented or out-of-range values rejected',()=>{
  const text='URGENT: Your bank account has been suspended.';
  const ok=validateModelReport({risk_level:'elevated',risk_score:60,detected_tactics:[{name:'Authority Impersonation',evidence:'Your bank account',confidence:0.8}],predicted_next_action:{action:'potential_malicious_link',confidence:0.6}},text);
  assert.equal(ok.risk,'caution');
  assert.equal(ok.tactics[0].tactic,'authority');
  assert.equal(ok.prediction.action,'potential_malicious_link');
  assert.throws(()=>validateModelReport({risk_level:'high',detected_tactics:[{name:'urgency',evidence:'act within 5 minutes'}]},text),/Ungrounded/);
  assert.throws(()=>validateModelReport({risk_level:'high',detected_tactics:[{name:'urgency',evidence:'URGENT',confidence:7}]},text),/confidence/);
  assert.throws(()=>validateModelReport({risk_level:'high',detected_tactics:[]},text),/evidence/);
  assert.throws(()=>validateModelReport({risk_level:'certain',detected_tactics:[]},text));
  assert.throws(()=>validateModelReport({risk_level:'low',predicted_next_action:{action:'wire_everything'}},text),/prediction/);
});
test('model evidence must quote the caller, never the customer',async()=>{
  const text='contact: Hello there.\nuser: Please send the money now, do not tell anyone.';
  const model=async()=>({risk_level:'high',detected_tactics:[{name:'secrecy',evidence:'do not tell anyone'}]});
  const result=await createService({store:store(),model}).analyze('u',{channel:'call',sequence:1,text});
  assert.equal(result.incomplete,true);
  assert.notEqual(result.risk,'high');
});
test('the rule provider is labeled, complete, and returns a structured report',async()=>{
  const service=createService({store:store(),provider:{id:'rules',label:'Rule-based baseline',model:'deterministic rules',call:null}});
  const result=await service.analyze('u',{channel:'message',sequence:1,text:messageSamples[0].text});
  assert.equal(result.incomplete,false);
  assert.equal(result.analysisSource,'rules-only');
  assert.equal(result.report.analysis_source,'rules');
  assert.equal(result.report.risk_level,'high');
  assert.equal(result.provider.id,'rules');
});
test('a model can raise a rating by one level only and its tactics are kept as derived codes',async()=>{
  const s=store();
  const text='Hi, are we still on for lunch tomorrow?';
  const model=async()=>({risk_level:'high',detected_tactics:[{name:'urgency',evidence:'lunch tomorrow',confidence:0.9}],explanation:'Model prose.'});
  const result=await createService({store:s,provider:{id:'gemini',label:'Google Gemini',model:'test',call:model}}).analyze('u',{channel:'message',sequence:1,text});
  assert.equal(result.risk,'caution');
  assert.equal(result.report.analysis_source,'gemini');
  const saved=JSON.stringify([...s.sessions.values()]);
  assert.ok(!saved.includes('lunch')&&!saved.includes('Model prose'));
});
test('Gemini adapter keeps the key out of the URL and rejects incomplete replies',async()=>{
  let calls=0;
  await assert.rejects(createGeminiClient({apiKey:'',fetchImpl:async()=>{calls++;}})('communication',{text:'x'}),(e)=>e.status===503);
  assert.equal(calls,0);
  let request;
  const ok=createGeminiClient({apiKey:'synthetic-gemini-key',model:'gemini-test',fetchImpl:async(url,options)=>{request={url,options,body:JSON.parse(options.body)};
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'hidden'},{text:'{"risk_level":"low","detected_tactics":[]}'}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:5}});}});
  const meta={};
  assert.deepEqual(await ok('communication',{text:'Hello'},meta),{risk_level:'low',detected_tactics:[]});
  assert.ok(!request.url.includes('synthetic-gemini-key'));
  assert.equal(request.options.headers['x-goog-api-key'],'synthetic-gemini-key');
  assert.match(request.url,/models\/gemini-test:generateContent$/);
  assert.equal(request.body.generationConfig.responseMimeType,'application/json');
  assert.deepEqual(meta.usage,{input:10,output:5});
  const truncated=createGeminiClient({apiKey:'k',fetchImpl:async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"risk_level":'}]}}]})});
  await assert.rejects(truncated('communication',{text:'x'}),(e)=>e.status===503);
});
test('provider resolution prefers explicit choice, then configured keys, then rules',()=>{
  const saved={...process.env};
  try{
    delete process.env.OPENROUTER_API_KEY;delete process.env.GEMINI_API_KEY;delete process.env.AI_PROVIDER;
    assert.equal(resolveProvider().id,'rules');
    assert.equal(resolveProvider().call,null);
    process.env.GEMINI_API_KEY='k';
    assert.equal(resolveProvider().id,'gemini');
    process.env.OPENROUTER_API_KEY='k';
    assert.equal(resolveProvider().id,'nemotron');
    assert.equal(resolveProvider('gemini').id,'gemini');
    assert.equal(resolveProvider('not-a-provider').id,'nemotron');
  }finally{for(const key of ['OPENROUTER_API_KEY','GEMINI_API_KEY','AI_PROVIDER']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
test('benchmarks report only what was measured, including failures',async()=>{
  const rules={id:'rules',label:'Rule-based baseline',model:'deterministic rules',call:null};
  const evaluation=await createService({store:store(),provider:rules}).benchmark({});
  assert.equal(evaluation.runs.length,EVALUATION_SCENARIOS.length);
  assert.equal(evaluation.summary.completed,EVALUATION_SCENARIOS.length);
  assert.equal(evaluation.summary.classification.of,EVALUATION_SCENARIOS.length);
  const broken={id:'nemotron',label:'Broken',model:'x',call:async(kind,input,meta)=>{meta.latencyMs=5;meta.usage={input:3,output:2};return {risk_level:'high',detected_tactics:[{name:'urgency',evidence:'not in any scenario text'}]};}};
  const failed=await createService({store:store(),provider:broken}).benchmark({scenarioIds:['sms-bank-b','call-genuine-c']});
  assert.equal(failed.summary.completed,0);
  assert.equal(failed.summary.failed,2);
  assert.equal(failed.summary.classification.of,0);
  assert.match(failed.runs[0].error,/validation/);
  assert.deepEqual(failed.summary.tokens,{input:6,output:4});
  assert.equal(failed.summary.reportedCost,null);
});
test('benchmark scoring penalizes tactics flagged on a benign scenario',()=>{
  const benign=EVALUATION_SCENARIOS.find((s)=>s.id==='call-genuine-c').expected;
  const score=scoreResult(benign,{risk:'caution',tactics:['urgency'],next:'payment'});
  assert.equal(score.classificationCorrect,false);
  assert.equal(score.tacticPrecision,0);
  assert.equal(score.nextActionCorrect,false);
});
test('benchmarking is limited to listed developers, or local development',()=>{
  const saved={...process.env};
  try{
    process.env.BENCHMARK_ALLOWED_EMAILS='dev@example.com';
    assert.doesNotThrow(()=>requireDeveloper({email:'Dev@Example.com'}));
    assert.throws(()=>requireDeveloper({email:'someone@example.com'}),(e)=>e.status===403);
    process.env.BENCHMARK_ALLOWED_EMAILS='';process.env.VERCEL='1';
    assert.throws(()=>requireDeveloper({email:'dev@example.com'}),(e)=>e.status===403);
  }finally{for(const key of ['BENCHMARK_ALLOWED_EMAILS','VERCEL']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
test('call transcripts parse into speaker turns for grounding',()=>{
  assert.equal(turnsFromText(transcript('family')).filter((t)=>t.speaker==='user').length,4);
});
