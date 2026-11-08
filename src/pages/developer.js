import { h, icon, badge, date } from '../ui.js';
import { EVALUATION_SCENARIOS, summarize } from '../../shared/evaluation.js';
import { TACTICS, NEXT_ACTIONS } from '../../shared/prediction.js';

const pct=(value)=>value==null?'—':Math.round(value*100)+'%';
const frac=(item)=>item.of?`${item.correct} / ${item.of}`:'—';
const tacticList=(keys=[])=>keys.length?keys.map((k)=>TACTICS[k]?.label||k).join(', '):'None';
const nextLabel=(key)=>key?NEXT_ACTIONS[key]?.label||key:'None';

// Rebuilds per-provider evaluations from stored evaluationScenarios documents.
function fromStored(stored=[]) {
  const byProvider={};
  for(const doc of stored){
    for(const [provider,entry] of Object.entries(doc.modelResults||{})){
      (byProvider[provider] ||= {provider:{id:provider,model:entry.model},ranAt:entry.ranAt,runs:[]}).runs.push({scenarioId:doc.id,...entry});
      if(entry.ranAt>byProvider[provider].ranAt)byProvider[provider].ranAt=entry.ranAt;
    }
  }
  for(const evaluation of Object.values(byProvider))evaluation.summary=summarize(evaluation.runs);
  return byProvider;
}

export function developer(state,ui) {
  const dev=ui.dev;
  const providers=state.demo?[{id:'rules',label:'Rule-based baseline',model:'deterministic rules',configured:true,local:true}]:dev.status?.providers||[];
  const results={...fromStored(dev.status?.stored),...dev.runs};
  const ran=Object.keys(results);
  return `<div class="page-intro"><div><span class="eyebrow">Developer tools</span><h1>Model evaluation</h1><p>Run the same ${EVALUATION_SCENARIOS.length} synthetic scenarios through each engine and compare the measured results. Customers never see this page.</p></div></div>
    <div class="notice">${icon('info')}<div><strong>Read results with care.</strong> Every number here comes from a run you started, and nothing is pre-filled. The rule baseline was written alongside these scenarios, so its scores are optimistic. ${EVALUATION_SCENARIOS.length} synthetic scenarios cannot establish real-world accuracy. Explanation quality needs human review.</div></div>
    ${dev.error?`<div class="notice error" role="alert">${h(dev.error)}</div>`:''}
    <section class="dev-providers" aria-labelledby="providers-title"><h2 id="providers-title">Engines</h2>
      ${!providers.length?`<p>${dev.loading?'Loading provider status…':'Provider status is unavailable.'}</p>`:''}
      <div class="provider-grid">${providers.map((p)=>`<article class="provider-card ${p.configured?'':'muted-section'}"><h3>${h(p.label)}</h3><p class="mono">${h(p.model)}</p>
        <span class="small-chip">${p.local?'Runs in your browser':p.configured?'Configured on server':'Not configured'}</span>
        <button class="button ${p.configured?'primary':'secondary'}" data-action="run-benchmark" data-provider="${h(p.id)}" ${!p.configured||dev.busy?'disabled':''}>${icon(dev.busy===p.id?'refresh':'play')}${dev.busy===p.id?'Running…':'Run scenarios'}</button></article>`).join('')}</div>
      ${state.demo?'<p class="field-help">Nemotron and Gemini runs need a signed-in developer account on a server with provider keys. See the README.</p>':''}</section>
    ${ran.length?`<section class="dev-results" aria-labelledby="summary-title"><h2 id="summary-title">Measured results</h2><div class="table-scroll" tabindex="0" role="region" aria-label="Summary by engine"><table class="data-table"><thead><tr><th scope="col">Engine</th><th scope="col">Scam vs. not scam</th><th scope="col">Risk level acceptable</th><th scope="col">Benign kept low</th><th scope="col">Next action</th><th scope="col">Tactic recall</th><th scope="col">Tactic precision</th><th scope="col">Median latency</th><th scope="col">Tokens (in / out)</th><th scope="col">Reported cost</th><th scope="col">Failed</th></tr></thead><tbody>
      ${ran.map((id)=>{const e=results[id],s=e.summary;return `<tr><th scope="row">${h(e.provider.label||id)}<small>${h(e.provider.model||'')} · ${h(date(e.ranAt,true))}</small></th><td>${frac(s.classification)}</td><td>${frac(s.riskLevel)}</td><td>${frac(s.benignKeptQuiet)}</td><td>${frac(s.nextAction)}</td><td>${pct(s.tacticRecall)}</td><td>${pct(s.tacticPrecision)}</td><td>${s.medianLatencyMs==null?'—':s.medianLatencyMs<10?'<10 ms':Math.round(s.medianLatencyMs)+' ms'}</td><td>${s.tokens.input||s.tokens.output?s.tokens.input+' / '+s.tokens.output:'—'}</td><td>${s.reportedCost==null?'Not reported':'$'+s.reportedCost.toFixed(4)}</td><td>${s.failed}</td></tr>`;}).join('')}</tbody></table></div>
      <p class="field-help">Benign kept low counts the scenarios without a scam that each engine rated low. It is the closest automatic measure of contextual understanding. Cost is shown only when the provider reports it.</p></section>
    <section class="dev-results" aria-labelledby="scenario-title"><h2 id="scenario-title">By scenario</h2><div class="scenario-results">${EVALUATION_SCENARIOS.map((s)=>`<details class="scenario-result"><summary><span><strong>${h(s.title)}</strong><small>${s.type==='sms'?'Text message':'Call transcript'} · expected ${s.expected.scam?'scam':'not a scam'}, ${h(s.expected.risk.join(' or '))}</small></span><span class="scenario-marks">${ran.map((id)=>{const run=results[id].runs.find((r)=>r.scenarioId===s.id);return `<span class="mark ${!run?'':run.error?'fail':run.score?.classificationCorrect&&run.score?.riskAcceptable?'pass':'fail'}" title="${h(results[id].provider.label||id)}">${!run?'–':run.error?'!':run.score?.classificationCorrect&&run.score?.riskAcceptable?'✓':'✗'}</span>`;}).join('')}</span></summary>
      <div class="scenario-body"><blockquote class="scenario-text">${h(s.text).replace(/\n/g,'<br>')}</blockquote><dl class="expected"><div><dt>Expected tactics</dt><dd>${h(tacticList(s.expected.tactics))}</dd></div><div><dt>Expected next action</dt><dd>${h(nextLabel(s.expected.next))}</dd></div></dl>
      ${ran.map((id)=>{const run=results[id].runs.find((r)=>r.scenarioId===s.id);if(!run)return '';return `<div class="engine-result"><h4>${h(results[id].provider.label||id)}</h4>${run.error?`<p class="incomplete-note">${h(run.error)}</p>`:`<p>${badge(run.result.risk)} · Next: ${h(nextLabel(run.result.next))} · ${run.latencyMs==null?'':Math.round(run.latencyMs)+' ms'}</p><p><strong>Tactics:</strong> ${h(tacticList(run.result.tactics))}</p>${run.result.explanation?`<p class="model-explanation"><strong>Explanation:</strong> ${h(run.result.explanation)}</p>`:''}`}</div>`;}).join('')}</div></details>`).join('')}</div></section>`:`<div class="empty-state">${icon('spark')}<h2>No results yet.</h2><p>Run an engine to measure it on the evaluation scenarios.</p></div>`}`;
}
