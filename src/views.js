import { h, icon, date, badge, riskLabels, highlight, contactAction } from './ui.js';
import { CATEGORIES } from '../shared/schema.js';
import { scenarios, historySets, messageSamples, getHistory } from '../shared/fixtures.js';
import { analyzeConversation } from '../shared/prediction.js';
import { extractIndicators, findConnections } from '../shared/network.js';

const nav=[
  ['home','home','Home'],['calls','phone','Call protection'],['messages','message','Check a message'],
  ['profile','person','My profile'],['learn','book','Safety guide'],['history','clock','Recent activity'],
];
export function shell(state,route,content,menuOpen=false) {
  const name=state.user?.displayName || 'Your account';
  return `<div class="app-shell">
    <aside class="sidebar ${menuOpen?'menu-open':''}" aria-label="Main navigation">
      <div class="sidebar-heading"><a class="brand" href="#/home"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></a><button class="mobile-menu-button button secondary" data-action="toggle-menu" aria-expanded="${menuOpen}" aria-controls="tsecure-navigation">${icon(menuOpen?'close':'menu')}Menu</button></div>
      <p class="brand-caption">A safer next step.</p>
      <nav id="tsecure-navigation" class="primary-nav">${nav.map(([id,glyph,label])=>`<a href="#/${id}" class="nav-link ${route===id?'active':''}" ${route===id?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span>${route===id?'<span class="nav-dot"></span>':''}</a>`).join('')}</nav>
      <div class="sidebar-bottom">
        <a href="#/t-life" aria-label="T-Life preview" class="nav-link ${route==='t-life'?'active':''}"><span class="t-monogram">T</span><span>T-Life preview</span>${icon('external')}</a>
        <a href="#/settings" aria-label="Settings" class="nav-link ${route==='settings'?'active':''}" ${route==='settings'?'aria-current="page"':''}>${icon('settings')}<span>Settings</span></a>
        <div class="sidebar-reassurance">${icon('heart')}<p>Take your time.<br><strong>You’re in control.</strong></p></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span class="workspace-label">Your safety space</span><div class="account-area"><span class="workspace-status"><span></span>${state.demo?'Demo workspace':'Personal workspace'}</span><a class="account-button" href="#/${state.demo?'account':'settings'}" aria-label="${state.demo?'Sign in or create an account':'Account settings'}"><span class="avatar">${h(name.charAt(0).toUpperCase())}</span><span>${state.demo?'Sign in':h(name.split(' ')[0])}</span>${icon('chevron')}</a></div></header>
      <main id="main" tabindex="-1">
        ${state.demo?`<div class="demo-note">${icon('info')}<span><strong>Interactive demo</strong><span class="demo-detail"> · Sample calls and histories. No phone monitoring.</span></span><a href="#/about">What’s included ${icon('arrow')}</a></div>`:''}
        ${state.syncError?`<div class="notice error" role="alert">${h(state.syncError)} <button class="text-button" data-action="retry-account">Retry</button></div>`:''}
        ${state.onboarding?`<div class="notice onboarding">${icon('spark')}<div><strong>Make protection more personal.</strong><p>Advanced analysis uses sample conversations to suggest helpful safety habits. It’s optional.</p></div><a class="button small" href="#/settings">Review options</a><button class="text-button" data-action="skip-onboarding">Skip for now</button></div>`:''}
        ${content}
        <footer class="page-footer">${icon('lock')}Your pace. Your choices. Your information.</footer>
      </main>
    </div>
  </div>`;
}
export function intro(title,description,action='') {return `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
export function home(state) {
  const count=state.incidents.length;
  return `<div class="home-heading"><div><h1>A little pause.<br>A safer next step.</h1><p>You don’t have to spot every scam alone.<br>Let’s take a closer look, together.</p></div><div class="home-signature">${icon('shield')}<span>Built around<br><strong>your peace of mind.</strong></span></div></div>
    <div class="home-grid"><div class="home-primary">
      <section class="practice-feature" aria-labelledby="practice-title"><div class="feature-copy"><h2 id="practice-title">A familiar voice.<br>An unfamiliar request.</h2><p>Learn what to do when a caller says they’re family—and asks for money.</p><a class="button primary" href="#/calls">Try a practice call ${icon('arrow')}</a><span class="quiet-note">About 35 seconds · No microphone needed</span></div>
      <div class="call-preview" aria-hidden="true"><div class="preview-phone"><div class="phone-notch"></div><span class="preview-avatar">${icon('person')}</span><strong>Unknown caller</strong><span class="preview-small">Incoming sample call</span><div class="voice-wave">${Array.from({length:19},(_,i)=>`<i style="--bar:${[12,20,32,18,40,28,46,22,35,50,30,18,42,24,36,14,28,20,12][i]}px;--delay:${i*.08}s"></i>`).join('')}</div><div class="preview-warning">${icon('shield')}<span><strong>It’s okay to pause.</strong><small>Verify before you act.</small></span></div></div><span class="preview-orbit orbit-one"></span><span class="preview-orbit orbit-two"></span></div></section>
      <section class="help-options" aria-labelledby="help-title"><h2 id="help-title">What would you like help with?</h2><a class="task-row" href="#/messages"><span class="task-symbol lilac">${icon('message')}</span><div><h3>Does this message look right?</h3><p>Check a text or website address for warning signs.</p></div>${icon('arrow')}</a><a class="task-row" href="#/recovery"><span class="task-symbol peach">${icon('heart')}</span><div><h3>Something happened. What now?</h3><p>Find clear, practical steps to take after a scam.</p></div>${icon('arrow')}</a></section>
    </div><aside class="home-aside">
      <section class="trusted-panel"><div class="section-topline"><span class="task-symbol pink">${icon('person')}</span><a class="text-link" href="#/settings">${state.contact?'Edit':'Set up'} ${icon('chevron')}</a></div><h2>Your trusted person</h2>${state.contact?`<p>A second opinion is just a call away.</p><div class="contact-summary"><span class="avatar large">${h(state.contact.name.charAt(0))}</span><div><strong>${h(state.contact.name)}</strong><span>${h(state.contact.relationship||'Trusted contact')}</span></div></div>${contactAction(state.contact)}`:`<p>Someone you can call when a request doesn’t feel quite right.</p><div class="contact-placeholder"><span></span><span></span><span></span></div><a class="button secondary full" href="#/settings">${icon('plus')}Add a trusted contact</a>`}<span class="quiet-note">Always your choice. Never contacted automatically.</span></section>
      <section class="habit-note"><span class="note-pin"></span><h2>A small habit.<br> A big difference.</h2><p>Hang up. Then call back using a number you already know.</p><a class="text-link" href="#/learn">Explore the safety guide ${icon('arrow')}</a></section>
    </aside></div>
    <section class="journey-strip" aria-label="Three moments of protection"><div><span>Before</span><strong>Build a safer habit</strong></div>${icon('arrow')}<div><span>During</span><strong>Pause and verify</strong></div>${icon('arrow')}<div><span>After</span><strong>Find your next step</strong></div></section>
    <section class="activity-preview"><div><h2>Your recent checks</h2><p>${count?count+' saved '+(count===1?'check':'checks')+' in this workspace.':'Your checks will appear here as you use T-Secure.'}</p></div><a class="text-link" href="#/history">View activity ${icon('arrow')}</a></section>`;
}
export function calls(state,ui) {
  return intro('A practice call.<br>A real safety habit.','Watch the conversation unfold. We’ll point out reasons to pause along the way.')+
  `<div class="call-toolbar"><label for="scenario">Practice scenario<select id="scenario" aria-label="Practice scenario" ${['playing','paused'].includes(ui.call.status)?'disabled':''}>${scenarios.map((s)=>`<option value="${s.id}" ${ui.scenario===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></label><span class="simulation-label">${icon('info')}Simulated live call · No recording</span></div>
  <div class="call-preparation"><p><strong>Before you begin:</strong> a familiar voice does not verify a caller. Keep a trusted number ready.</p><div class="call-audio-control"><label for="call-alert-audio">Call alert audio</label><select id="call-alert-audio"><option value="visual" ${ui.callAudio==='visual'?'selected':''}>Visual alerts only</option><option value="tone" ${ui.callAudio==='tone'?'selected':''}>Visual + gentle tone</option><option value="speech" ${ui.callAudio==='speech'?'selected':''}>Visual + spoken guidance</option></select></div><p class="field-help">One alert per risk level, per call. Audio is optional and plays on this device. <span id="call-audio-status" role="status">${ui.audioUnavailable?'Audio is unavailable. Visual alerts remain active.':''}</span></p></div>
  <div id="call-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div><div id="call-workspace">${callWorkspace(state,ui)}</div>`;
}
const lowerFirst=(text='')=>text.charAt(0).toLowerCase()+text.slice(1);
function effectiveRisk(snapshot) {
  const level=snapshot.insight?.level||'low',risk=snapshot.analysis?.risk||'low';
  const rank={low:0,unknown:0,caution:1,high:2};
  return rank[level]>rank[risk]?level:risk;
}
export function callWarningDialog(snapshot,state) {
  const prediction=snapshot.insight?.prediction;
  const reasons=snapshot.analysis.reasons.length?snapshot.analysis.reasons.slice(-2).map(reason=>({label:CATEGORIES[reason.code]?.label||'Warning sign',evidence:reason.evidence})):(snapshot.insight?.findings||[]).slice(-3).map(f=>({label:f.label,evidence:f.excerpt}));
  return `<div class="call-warning-heading"><h2 id="call-warning-title">Pause and verify this caller.</h2><button class="dialog-close" data-action="keep-call-paused" aria-label="Keep call paused" autofocus>${icon('close')}</button></div>
    <div class="call-warning-body" role="region" aria-label="Warning details" tabindex="0"><p id="call-warning-copy">${snapshot.alert?.predictive?'This conversation is following a known scam pattern. The practice call is paused before the next step.':'This request has serious warning signs. The practice call is paused.'}</p>
    ${prediction?`<div class="dialog-prediction"><span>${icon('spark')}What may come next · ${h(prediction.strengthLabel)}</span><strong>The caller may ${h(lowerFirst(prediction.action))}.</strong></div>`:''}
    <ul class="call-warning-evidence">${reasons.map(reason=>`<li><strong>${h(reason.label)}</strong><blockquote>“${h(reason.evidence.slice(0,180))}${reason.evidence.length>180?'…':''}”</blockquote></li>`).join('')}</ul>
    <p>${prediction?h(prediction.advice):'Hold off on sharing codes or sending money. Call back using a number you already trust.'}</p>
    <p class="privacy-footnote">A warning sign is a reason to verify. It does not prove who is calling.</p></div>
    <div class="call-warning-actions"><button class="button danger" data-action="end-call">${icon('phone')}End demo call</button>${contactAction(state.contact)}<button class="button secondary" data-action="continue-call">Continue demo</button></div>`;
}
export function callWorkspace(state,ui) {
  const snapshot=ui.call;
  const active=['playing','paused'].includes(snapshot.status);
  const scenario=scenarios.find((s)=>s.id===ui.scenario)||scenarios[0];
  const analysis=snapshot.analysis;
  const labels={idle:'Ready when you are',playing:'Call in progress',paused:'Paused',ended:'Call ended',completed:'Practice complete'};
  const alert=active?snapshot.alert:null;
  const prediction=snapshot.insight?.prediction;
  const risk=effectiveRisk(snapshot);
  const marks=[...analysis.reasons,...(snapshot.insight?.findings||[]).map(f=>({evidence:f.excerpt}))];
  const transcript=snapshot.turns.map(t=>t.speaker+': '+t.text).join('\n');
  const connections=snapshot.turns.length&&risk!=='low'?findConnections(extractIndicators({text:transcript,sender:scenario.number}),{incidents:state.incidents,excludeId:snapshot.sessionId}):null;
  return `${alert?`<section class="call-live-alert ${h(alert.risk)}" aria-label="Current call warning">${icon('alert')}<div><strong>${h(riskLabels[alert.risk])} · Pause and verify</strong><p>${alert.predictive&&prediction?'The caller may '+h(lowerFirst(prediction.action))+'. Verify before you act.':alert.risk==='high'?'Verify the caller before sharing information or sending money.':'Pressure or urgency deserves a second look.'}</p></div><button class="text-button" data-action="${alert.risk==='high'?'review-call-warning':'pause-to-verify'}">${alert.risk==='high'?'Review alert':'Pause to verify'}</button></section>`:''}
  <div class="call-grid"><section class="conversation-panel"><div class="call-person"><span class="call-avatar">${h(scenario.initials)}</span><div><h2>${h(scenario.caller)}</h2>${scenario.number?`<span class="call-number">${h(scenario.number)}</span>`:''}<span class="call-state"><i class="${snapshot.status==='playing'?'pulsing':''}"></i>${labels[snapshot.status]}</span></div><span class="small-chip">${snapshot.turns.length?h(riskLabels[risk]):'Sample call'}</span></div>
    <div class="transcript" role="log" tabindex="0" aria-label="Sample conversation transcript" aria-live="off">${snapshot.turns.length?`<ol>${snapshot.turns.map((t)=>`<li class="turn ${t.speaker}"><span>${t.speaker==='contact'?'Caller':'You · sample response'}</span><p>${highlight(t.text,marks)}</p></li>`).join('')}</ol>`:`<div class="transcript-empty">${icon('headphones')}<h3>Take a moment to practice.</h3><p>${h(scenario.description)}</p><p class="quiet-note">Read along as a sample conversation appears. Nothing is recorded or connected to your phone.</p></div>`}</div>
    <div class="call-controls">${active?`<button class="button secondary" data-action="${snapshot.status==='paused'?'resume':'pause'}">${icon(snapshot.status==='paused'?'play':'pause')}${snapshot.status==='paused'?'Resume call':'Pause call'}</button><button class="button danger" data-action="end-call">${icon('phone')}End demo call</button>`:`<button class="button primary" data-action="start-call">${icon('play')}${snapshot.status==='idle'?'Start practice call':'Practice again'}</button><span class="quiet-note">${snapshot.status==='idle'?'You can pause or end at any time.':'You stayed in control. That’s the habit.'}</span>`}</div></section>
    <aside class="call-guidance" tabindex="-1">${snapshot.turns.length?predictionCard(snapshot):''}${connections&&(connections.campaigns.length||connections.history.length)?networkPanel(connections,state):''}${analysisPanel({...analysis,risk},state,true)}<div class="simple-note">${icon('lock')}<p>Voices and caller names can be imitated. Use a saved number to verify independently.</p></div></aside></div>
    ${snapshot.turns.length?manipulationTimeline(snapshot):''}
    ${!active&&snapshot.turns.length?`<section class="call-followup"><h2>After the call, take your next step.</h2><p>${analysis.risk==='high'?'If you shared information or sent money, follow the recovery steps promptly.':'Keep practicing an independent callback before acting on unexpected requests.'}</p><div class="button-row"><a class="button primary" href="#/recovery${snapshot.sessionId?'/'+h(snapshot.sessionId):''}">Get recovery guidance ${icon('arrow')}</a><a class="text-link" href="#/learn">Build a safer habit ${icon('book')}</a></div></section>`:''}`;
}
export function predictionCard(snapshot) {
  const prediction=snapshot.insight?.prediction;
  if(!prediction)return `<section class="prediction-card quiet" aria-label="Predicted next step"><span class="prediction-eyebrow">${icon('spark')}What may come next</span><p>Watching how the conversation develops. No scam pattern so far.</p></section>`;
  const {strength,strengthLabel,confirmed}=prediction;
  const filled={possible:1,likely:2,strong:3}[strength];
  return `<section class="prediction-card ${h(strength)}" aria-label="Predicted next step"><div class="prediction-top"><span class="prediction-eyebrow">${icon('spark')}What may come next</span><span class="likelihood">${h(strengthLabel)}</span></div>
    <div class="likelihood-meter" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n<=filled?'on':''}"></i>`).join('')}</div>
    ${confirmed?`<p class="prediction-confirmed">${icon('check')}${snapshot.predictedAt&&snapshot.predictedAt.turn<confirmed.turn?`Predicted at turn ${snapshot.predictedAt.turn}, before the request at turn ${confirmed.turn}`:`Request detected at turn ${confirmed.turn}`}</p><h3>They asked you to ${h(lowerFirst(confirmed.label))}. Next, they may ${h(lowerFirst(prediction.followUp))}.</h3>`:`<h3>The caller may ${h(lowerFirst(prediction.action))}.</h3>`}
    <p class="prediction-pattern">${h(prediction.name)}</p>
    <h4>Why we think so</h4><ul class="prediction-evidence">${prediction.evidence.map(f=>`<li><strong>${h(f.label)}</strong><span>“${h(f.excerpt)}”</span></li>`).join('')}</ul>
    <div class="prediction-advice">${icon('shield')}<p><strong>Safer step:</strong> ${h(prediction.advice)}</p></div>
    <p class="prediction-uncertainty">${icon('info')}${h(prediction.uncertainty)}</p></section>`;
}
export function manipulationTimeline(snapshot) {
  const {findings=[],requests=[]}=snapshot.insight||{};
  const turns=[...new Set([...findings.map(f=>f.turn),...requests.map(r=>r.turn),snapshot.predictedAt?.turn].filter(Boolean))].sort((a,b)=>a-b);
  if(!turns.length)return '';
  return `<section class="manipulation-timeline" aria-labelledby="timeline-title"><div class="timeline-heading"><h2 id="timeline-title">How the conversation developed</h2><p>Each tactic we noticed, in order. Based only on the words used, never a judgment of who is calling.</p></div>
    <ol class="timeline">${turns.map(turn=>{
      const here=findings.filter(f=>f.turn===turn),asked=requests.filter(r=>r.turn===turn);
      const time=here[0]?.time;
      return `<li class="timeline-step ${asked.length?'request':''}"><span class="timeline-marker"></span><div class="timeline-meta">Turn ${turn}${time?` · ${h(time)}`:''}</div>
        ${here.map(f=>`<div class="timeline-finding"><div class="timeline-finding-head"><strong>${h(f.label)}</strong><span class="confidence ${h(f.confidence)}">${h(f.confidence)} confidence</span></div><blockquote>“${h(f.excerpt)}”</blockquote><p>${h(f.explanation)}</p></div>`).join('')}
        ${asked.map(r=>`<div class="timeline-request">${icon('alert')}<p><strong>Request: ${h(r.label)}</strong> “${h(r.excerpt)}”</p></div>`).join('')}
        ${snapshot.predictedAt?.turn===turn?`<div class="timeline-predicted">${icon('spark')}<p><strong>Prediction made:</strong> the caller may ${h(lowerFirst(snapshot.predictedAt.action))}.</p></div>`:''}</li>`;
    }).join('')}</ol></section>`;
}
export function analysisPanel(analysis,state,call=false) {
  const risk=analysis?.risk||'low';
  return `<section class="analysis-panel ${h(risk)}"><span class="analysis-symbol">${icon(risk==='high'||risk==='caution'?'alert':risk==='unknown'?'info':'shield')}</span><span class="assessment-eyebrow">Risk assessment</span><h2>${h(riskLabels[risk])}</h2><p>${risk==='high'?'This request has serious warning signs. Pause before sharing information or sending money.':risk==='caution'?'A few things deserve a second look. Take your time and verify independently.':risk==='unknown'?'AI analysis is unavailable or the context is incomplete. Keep verifying independently.':'We haven’t found a clear warning in this content. Independent verification is still a good habit.'}</p>
    ${analysis?.reasons?.length?`<ul class="reason-list">${analysis.reasons.map((reason)=>`<li><strong>${h(CATEGORIES[reason.code]?.label||'Warning sign')}</strong><blockquote>“${h(reason.evidence)}”</blockquote></li>`).join('')}</ul>`:''}
    ${['high','caution','unknown'].includes(risk)?`<div class="guidance-actions">${contactAction(state.contact)}<a class="text-link" href="#/learn">View warning signs ${icon('arrow')}</a>${!call?'<a class="text-link" href="#/recovery">Already acted on it? Find next steps.</a>':''}</div>`:''}
    <div class="analysis-source">${icon('info')}${analysis?.analysisSource==='hybrid'?'Nemotron + independent rule checks':'Independent rule checks'}${state.demo?' · Local demo':''}</div>${analysis?.incomplete?'<p class="incomplete-note">AI analysis could not finish. Existing rule warnings remain active.</p>':''}</section>`;
}
const verifyGuidance={
  bank:'Call the number on the back of your card, or open your bank’s official app. Your bank will never text you for a verification code.',
  delivery:'Open the carrier’s official app, or type its website yourself, and enter the tracking number from your receipt.',
  government:'Look up the agency’s official number on its .gov website. Agencies send letters first and never demand gift cards or crypto.',
  family:'Call them on the number already saved in your phone, or ask another family member to check.',
  romance:'Talk it over with someone you trust. Never send money to someone you haven’t met in person.',
  support:'Contact the company through its official website, typed in yourself. Real support teams don’t reach out unexpectedly.',
};
function checkedAnalysis(ui) {
  const checked=ui.messageChecked;
  if(!checked||!ui.messageResult)return null;
  const insight=analyzeConversation([{speaker:'contact',text:checked.text}]);
  const rank={low:0,unknown:0,caution:1,high:2};
  const risk=rank[insight.level]>rank[ui.messageResult.risk]?insight.level:ui.messageResult.risk;
  return {checked,insight,risk};
}
function messageAssessment(result,insight,risk,state) {
  const tactics=[...new Map(insight.findings.map(f=>[f.tactic,f])).values()];
  const indicators=[...insight.requests.map(r=>({label:'Request: '+r.label,evidence:r.excerpt})),...tactics.map(f=>({label:f.label,evidence:f.excerpt})),...result.reasons.map(r=>({label:CATEGORIES[r.code]?.label||'Warning sign',evidence:r.evidence}))]
    .filter((item,i,all)=>all.findIndex(other=>other.evidence===item.evidence)===i).slice(0,5);
  const request=insight.requests[0];
  const why=risk==='high'?`${request?'It asks you to '+h(lowerFirst(request.label)):'It follows a known scam pattern'}${tactics.length?', alongside '+tactics.length+' pressure '+(tactics.length===1?'tactic':'tactics'):''}. Together, these are strong warning signs.`
    :risk==='caution'?'Some warning signs are present, but not enough to be sure. Verify before you act on it.'
    :risk==='unknown'?'AI analysis could not finish and the rule checks found nothing clear. Keep verifying independently.'
    :'No request for money, codes, or personal details, and no pressure tactics. A single word on its own is never enough to flag a message.';
  return `<section class="analysis-panel message-assessment ${h(risk)}" aria-labelledby="assessment-title"><span class="analysis-symbol">${icon(risk==='high'||risk==='caution'?'alert':risk==='unknown'?'info':'shield')}</span>
    <span class="assessment-eyebrow">Risk assessment</span><h2 id="assessment-title">${h(riskLabels[risk])}</h2><p>${why}</p>
    ${indicators.length?`<h3 class="assessment-subhead">Most important indicators</h3><ul class="reason-list">${indicators.map(item=>`<li><strong>${h(item.label)}</strong><blockquote>“${h(item.evidence)}”</blockquote></li>`).join('')}</ul>`:''}
    <div class="analysis-source">${icon('info')}${result.analysisSource==='hybrid'?'Nemotron context + deterministic checks. AI can raise a rating by one level at most.':'Deterministic pattern and rule checks'}${state.demo?' · Local demo':''}</div>${result.incomplete?'<p class="incomplete-note">AI analysis could not finish. Rule-based warnings remain active.</p>':''}</section>`;
}
function messageBreakdown(text,insight) {
  const ordered=[...insight.findings].sort((a,b)=>a.index-b.index);
  return `<section class="manipulation-timeline" id="message-breakdown" tabindex="-1" aria-labelledby="breakdown-title"><div class="timeline-heading"><h2 id="breakdown-title">Message Manipulation Breakdown</h2><p>The tactics in this one message, in the order they appear. This is a single message, not a conversation history.</p></div>
    <blockquote class="breakdown-message">${highlight(text,[...ordered.map(f=>({evidence:f.excerpt})),...insight.requests.map(r=>({evidence:r.excerpt}))])}</blockquote>
    ${ordered.length||insight.requests.length?`<ol class="timeline">${ordered.map(f=>`<li class="timeline-step"><span class="timeline-marker"></span><div class="timeline-finding"><div class="timeline-finding-head"><strong>${h(f.label)}</strong><span class="confidence ${h(f.confidence)}">${h(f.confidence)} confidence</span></div><blockquote>“${h(f.excerpt)}”</blockquote><p>${h(f.explanation)}</p></div></li>`).join('')}${insight.requests.map(r=>`<li class="timeline-step request"><span class="timeline-marker"></span><div class="timeline-request">${icon('alert')}<p><strong>Request: ${h(r.label)}</strong> “${h(r.excerpt)}”</p></div></li>`).join('')}</ol>`:'<p class="breakdown-empty">No manipulation tactics found in this message.</p>'}</section>`;
}
function messagePrediction(insight) {
  const prediction=insight.prediction;
  if(!prediction||prediction.strength==='possible')return `<section class="prediction-card quiet" aria-labelledby="next-title"><span class="prediction-eyebrow">${icon('spark')}<span id="next-title">What Might Happen Next?</span></span><p>T-Secure can’t confidently predict a next step from this message. There isn’t enough evidence. If the sender follows up asking for money, codes, or personal details, check that message too.</p></section>`;
  const filled={possible:1,likely:2,strong:3}[prediction.strength];
  const asked=prediction.confirmed;
  return `<section class="prediction-card ${h(prediction.strength)}" aria-labelledby="next-title"><div class="prediction-top"><span class="prediction-eyebrow">${icon('spark')}<span id="next-title">What Might Happen Next?</span></span><span class="likelihood">${h(prediction.strengthLabel)}</span></div>
    <div class="likelihood-meter" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n<=filled?'on':''}"></i>`).join('')}</div>
    <h3>${asked?`This message already asks you to ${h(lowerFirst(asked.label))}. If you respond, the sender may ${h(lowerFirst(prediction.followUp))}.`:`If you respond, the sender may ${h(lowerFirst(prediction.action))}.`}</h3>
    <p class="prediction-pattern">${h(prediction.name)}</p>
    <h4>Why we think so</h4><ul class="prediction-evidence">${prediction.evidence.map(f=>`<li><strong>${h(f.label)}</strong><span>“${h(f.excerpt)}”</span></li>`).join('')}</ul>
    <div class="prediction-advice">${icon('shield')}<p><strong>Recommended:</strong> ${h(prediction.advice)}</p></div>
    <p class="prediction-uncertainty">${icon('info')}${h(prediction.uncertainty)}</p></section>`;
}
export function networkPanel(connections,state) {
  const {campaigns,history}=connections;
  const meter=(strength)=>`<div class="likelihood-meter" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n<={possible:1,moderate:2,strong:3}[strength]?'on':''}"></i>`).join('')}</div>`;
  const shared=(items)=>`<ul class="network-shared">${items.map(s=>`<li><strong>${h(s.type)}</strong><span>${h(s.detail)}</span><small>${h(s.why)}</small></li>`).join('')}</ul>`;
  return `<section class="network-panel" aria-labelledby="network-title"><div class="network-heading"><div><span class="prediction-eyebrow">${icon('shield')}Engine 5</span><h2 id="network-title">Scam Network Intelligence</h2></div><span class="small-chip">Demo intelligence</span></div>
    ${!campaigns.length&&!history.length?'<p class="network-empty">No connection found to the demo campaign dataset or your earlier checks. That alone doesn’t mean it’s safe.</p>':''}
    ${campaigns.map(c=>`<article class="network-match ${h(c.strength)}"><div class="prediction-top"><h3>Possible campaign: ${h(c.name)}</h3><span class="likelihood">${h(c.strengthLabel)}</span></div>${meter(c.strength)}<p>${h(c.summary)}</p><h4>What connects them</h4>${shared(c.shared)}
      <details class="network-related"><summary>View related indicators ${icon('plus')}</summary><ul>${c.related.map(([type,value,why])=>`<li><strong>${h(type)}: ${h(value)}</strong><span>${h(why)}</span></li>`).join('')}</ul></details></article>`).join('')}
    ${history.length?`<h3 class="network-subhead">Similar to your earlier checks</h3>${history.map(m=>`<article class="network-match ${h(m.strength)}"><div class="prediction-top"><h3>${m.channel==='call'?'Practice call':'Message check'} · ${h(date(m.updatedAt,true))}</h3><span class="likelihood">${h(m.strengthLabel)}</span></div>${meter(m.strength)}${shared(m.shared)}</article>`).join('')}`:''}
    <p class="prediction-uncertainty">${icon('info')}${h(connections.uncertainty)} Campaigns are a synthetic demo dataset${state.demo?'':' plus your own saved checks'}, not carrier-wide data. Other customers’ messages are never used.</p></section>`;
}
function messageActions(insight,risk,result) {
  const org=insight.orgs[0];
  const saved=result.sessionId;
  return `<section class="message-actions" aria-label="What you can do"><h2>What you can do</h2><div class="action-list">
    <details class="action-disclosure"><summary>${icon('phone')}How do I verify this?</summary><div><p>${h(verifyGuidance[org]||'Contact the organization or person using a phone number or website you find yourself, not one from the message.')}</p><p>Don’t reply, call numbers, or tap links in the message itself.</p></div></details>
    <button class="action-disclosure-button" data-action="show-evidence">${icon('book')}Show evidence</button>
    <details class="action-disclosure"><summary>${icon('arrow')}What should I do next?</summary><div><ol class="next-steps">${(risk==='high'?['Don’t reply or tap any links.','Verify independently using a number you already trust.','Report the message, then delete it.','Talk to your trusted person if you feel unsure.']:risk==='caution'?['Pause before acting on the request.','Verify independently using a number you already trust.','If it still feels wrong, report it.']:['No clear warning signs, but stay alert to follow-up requests.','If anyone asks for money, codes, or personal details, verify first.']).map(s=>`<li>${h(s)}</li>`).join('')}</ol><a class="text-link" href="#/recovery">Already replied, paid, or shared a code? Find next steps ${icon('arrow')}</a></div></details>
    <details class="action-disclosure"><summary>${icon('alert')}Report or mark as suspicious</summary><div><p><strong>Forward the text to 7726</strong> (spells “SPAM”). It’s free and helps carriers, including T-Mobile, block similar messages.</p><p>Block the sender in your messages app, then delete the message.</p><a class="resource-link" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">Report fraud to the FTC ${icon('external')}</a></div></details>
    <details class="action-disclosure"><summary>${icon('clock')}Save to protection history</summary><div>${result.saved===false?'<p>We couldn’t save this check right now. The results on this page are still complete. Please try again later.</p>':saved?`<p>${icon('check')} Saved to Recent activity. ${['caution','high'].includes(risk)?'We keep the warning categories and derived indicators (like domains and sender), never the message text.':'For ordinary messages we keep only the result, never the text or sender.'}</p><a class="text-link" href="#/history">View Recent activity ${icon('arrow')}</a>`:'<p>Finishing the check… it will appear in Recent activity.</p>'}</div></details>
  </div></section>`;
}
export function messages(state,ui) {
  const analysis=checkedAnalysis(ui);
  const connections=analysis?findConnections(extractIndicators(analysis.checked),{incidents:state.incidents,excludeId:ui.messageResult.sessionId}):null;
  return intro('A second look at that message.','Paste a suspicious text or website address. We’ll help you understand the warning signs.')+
  `<div class="message-grid"><section class="form-panel"><form id="message-form"><label for="message-text">Message or website address</label><textarea id="message-text" name="text" rows="7" maxlength="12000" placeholder="Paste the message here. You don’t need to open any links." required>${h(ui.messageText)}</textarea><div class="input-meta"><span>Keep personal details out when possible.</span><span>12,000 character limit</span></div><label for="message-sender">Who sent it? <span class="optional-label">Optional</span></label><input id="message-sender" name="sender" maxlength="40" autocomplete="off" value="${h(ui.messageSender)}" placeholder="Phone number or sender name"><p class="field-help">Helps spot repeated senders across your checks.</p><button class="button primary" type="submit" ${ui.messageBusy?'disabled':''}>${icon(ui.messageBusy?'refresh':'shield')}${ui.messageBusy?'Checking…':'Analyze message'}</button></form><div class="sample-options"><p>Or try a sample</p>${messageSamples.map((s,i)=>`<button class="sample-button" data-action="message-sample" data-index="${i}">${h(s.name)}${icon('plus')}</button>`).join('')}</div></section><aside>${analysis?messageAssessment(ui.messageResult,analysis.insight,analysis.risk,state):`<div class="checking-empty">${icon('message')}<h2>A little context helps.</h2><p>Include what the sender is asking you to do. We’ll check the language and link structure.</p><div class="simple-note">${icon('lock')}<p>Submitted links stay as text. We never open them for you.</p></div></div>`}</aside></div>
  ${analysis?`<div class="message-insights">${messageActions(analysis.insight,analysis.risk,ui.messageResult)}<div class="insight-grid">${messageBreakdown(analysis.checked.text,analysis.insight)}<div class="insight-side">${messagePrediction(analysis.insight)}${networkPanel(connections,state)}</div></div></div>`:''}
  <p class="privacy-footnote">${state.demo?'In this local demo, messages are checked with rules in your browser. Connected accounts can use Nemotron analysis through OpenRouter.':'Submitted text is sent through the secure API to OpenRouter for Nemotron analysis. Raw message text is not saved in your history.'}</p>`;
}
export function advancedControls(state,ui) {
  const enabled=state.consent.enabled;
  return `<div class="advanced-controls"><div class="toggle-row"><div><label for="advanced">Enable advanced AI analysis</label><p>Use sample conversations to find patterns and personalize your safety guidance.</p></div><label class="switch-target"><span class="sr-only">Advanced analysis switch</span><input class="switch" id="advanced" type="checkbox" role="switch" ${enabled?'checked':''}></label></div>
    <div class="advanced-details ${enabled?'':'muted-section'}"><label for="history-set">Sample conversation history</label><select id="history-set" ${!enabled?'disabled':''}>${historySets.map((s)=>`<option value="${s.id}" ${state.consent.historySetId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select><p class="field-help">${h(historySets.find((s)=>s.id===state.consent.historySetId)?.description||'')} All conversations are synthetic.</p><div class="button-row"><button class="button secondary" data-action="analyze-profile" ${!enabled||ui.profileBusy?'disabled':''}>${icon('refresh')}${ui.profileBusy?'Analyzing sample…':'Analyze again'}</button><button class="text-button destructive" data-action="delete-assessment" ${!state.assessment?'disabled':''}>Delete assessment</button></div></div>
    <p class="privacy-footnote">Optional, and off by default. Turning this off removes your assessment from both profile views. Standard protection stays available.</p></div>`;
}
export function assessmentView(state) {
  const assessment=state.assessment;
  if(!assessment)return `<div class="profile-empty">${icon('spark')}<h2>Understand the patterns.<br>Build the habits.</h2><p>Advanced analysis looks at sample responses to suspicious requests and explains where an extra pause could help.</p><a class="button primary" href="#/settings">${state.consent.enabled?'Analyze sample conversations':'Explore advanced analysis'}${icon('arrow')}</a><p class="quiet-note">Your real conversations are not accessed.</p></div>`;
  const c=assessment.coverage;
  return `<section class="assessment-summary"><div class="score-block">${assessment.score===null?`<span class="empty-score">—</span><h2>Insufficient information</h2><p>We need at least five assessable responses across three conversations.</p>`:`<div class="score-value"><strong data-testid="vulnerability-score">${assessment.score}</strong><span>/ 100</span></div><h2>Scam Vulnerability Score</h2><div class="score-scale" aria-hidden="true"><span style="width:${assessment.score}%"></span></div><p>Higher means more risky responses observed in this sample.</p>`}<span class="sample-disclaimer">Demo estimate based on sample conversations.</span></div>
    <div class="coverage-block"><h3>What this assessment is based on</h3><dl class="coverage-list"><div><dt>Assessable responses</dt><dd>${c.assessable}</dd></div><div><dt>Risky responses</dt><dd>${c.risky}</dd></div><div><dt>Protective responses</dt><dd>${c.protective}</dd></div><div><dt>Conversations with evidence</dt><dd>${c.conversations}</dd></div></dl><p class="quiet-note">${c.unclear?c.unclear+' unclear responses excluded. ':''}Sample window: ${date(assessment.windowStart)} – ${date(assessment.windowEnd)}.</p><p class="assessment-time" data-testid="assessment-time">Updated ${date(assessment.generatedAt,true)}</p></div></section>
    <section class="patterns-section"><h2>Patterns worth a pause</h2><p>${assessment.categories.some((c)=>c.risky)?'A closer look at the situations in this sample.':'Protective habits were observed in these situations. Keep verifying independently.'}</p><div class="pattern-list">${assessment.categories.map((item)=>`<div class="pattern-row"><div><h3>${h(CATEGORIES[item.category].label)}</h3><p>${h(CATEGORIES[item.category].advice)}</p></div><span class="pattern-count">${item.risky} / ${item.assessable}<small>risky responses</small></span></div>`).join('')}</div></section>
    <details class="score-method"><summary>How is this score calculated?</summary><p>100 × risky responses ÷ assessable responses, rounded to a whole number. Unclear replies are excluded. At least five assessable responses across three conversations are required.</p><p>This is an unvalidated prototype behavior index. Sample results do not describe your actual susceptibility. Incoming messages alone never increase the score.</p><p>${assessment.analysisSource==='demo-fixture'?'This demo uses annotated sample evidence, without calling an AI model.':'Nemotron extracts supported evidence; application code calculates the number.'} Rubric ${h(assessment.rubricVersion)}.</p></details>`;
}
export function profile(state,ui,tLife=false) {
  const content=`${assessmentView(state)}${tLife?`<section class="settings-section"><h2>Your analysis preferences</h2>${advancedControls(state,ui)}</section>`:`<div class="profile-links"><a class="button secondary" href="#/settings">${icon('settings')}Manage analysis preferences</a><a class="text-link" href="#/t-life">See this in the T-Life preview ${icon('external')}</a></div>`}`;
  return tLife?intro('Your T-Life profile preview.','A concept view of the same private T-Secure assessment.')+
    `<section class="t-life-shell"><header class="t-life-header"><span class="t-life-logo">T<span>Life</span></span><span class="small-chip">Concept demo</span></header><nav class="t-life-crumb" aria-label="T-Life preview breadcrumb"><span>Manage</span>${icon('chevron')}<span>T-Secure</span>${icon('chevron')}<strong>Profile</strong></nav><div class="t-life-body">${content}</div><p class="t-life-disclaimer">A web prototype. This does not connect to or modify the actual T-Life app.</p></section>`:
    intro('Your patterns. Your next steps.','Personal guidance starts with understanding how you respond.')+content;
}
export function settings(state,ui) {
  return intro('Protection, on your terms.','Choose what feels right for you. You can change your mind anytime.')+
  `<div class="settings-grid"><div><section class="settings-section"><div class="section-heading">${icon('spark')}<div><h2>Advanced AI analysis</h2><p>Learn from recent sample conversations.</p></div><span class="small-chip">Optional</span></div>${advancedControls(state,ui)}</section>
    <section class="settings-section" id="trusted-contact"><div class="section-heading">${icon('person')}<div><h2>Your trusted contact</h2><p>A person you can call to get a second opinion.</p></div></div><form id="contact-form"><label for="contact-name">Contact name</label><input id="contact-name" name="name" autocomplete="off" maxlength="80" value="${h(state.contact?.name)}" placeholder="e.g. Jordan" required><label for="relationship">Relationship</label><input id="relationship" name="relationship" maxlength="60" value="${h(state.contact?.relationship)}" placeholder="e.g. Daughter, friend, neighbor"><label for="contact-phone">Phone number</label><input id="contact-phone" name="phone" type="tel" maxlength="30" value="${h(state.contact?.phone)}" placeholder="+1 (555) 000-0000" required><div class="button-row"><button class="button primary" type="submit">Save trusted contact</button>${state.contact?'<button class="text-button destructive" type="button" data-action="delete-contact">Remove contact</button>':''}</div></form><p class="privacy-footnote">Never contacted automatically. A saved contact does not authenticate an incoming caller.</p></section></div>
    <aside class="settings-aside"><section class="simple-section"><h2>Your information stays yours.</h2><p>We save preferences and derived summaries. Raw messages and live transcripts are not saved.</p><p>Historical analysis uses synthetic conversations only.</p><a class="text-link" href="#/about">About this demo ${icon('arrow')}</a></section><section class="simple-section account-settings"><h2>Account</h2><p>${state.demo?'You’re exploring a local demo. Your sample settings stay in this browser.':h(state.user.email)}</p>${state.demo?'<a class="button secondary" href="#/account">Sign in or create account</a>':'<button class="button secondary" data-action="logout">Sign out</button>'}<p class="quiet-note">${state.demo?'No Firebase account is being impersonated.':'Your private profile is only available while signed in.'}</p></section></aside></div>`;
}
export function history(state) {
  return intro('Your recent checks.','A record of the moments you took a closer look.')+
    `<section class="history-section">${state.incidents.length?`<div class="history-list">${state.incidents.map((item)=>`<article class="history-row"><span class="task-symbol ${item.channel==='call'?'pink':'lilac'}">${icon(item.channel==='call'?'phone':'message')}</span><div class="history-main"><h2>${item.channel==='call'?'Practice call':item.channel==='link'?'Website address check':'Message check'}</h2><span>${date(item.updatedAt,true)} · ${item.source==='simulation'?'Simulated conversation':'Submitted content'}</span><p>${item.reasonCodes?.map((c)=>h(CATEGORIES[c]?.label||c)).join(' · ')||'No specific warning category recorded.'}</p>${(()=>{const c=item.indicators&&findConnections(item.indicators).campaigns[0];return c?`<span class="network-chip">${icon('shield')}${h(c.strengthLabel)}: ${h(c.name)} · demo intelligence</span>`:'';})()}</div><div class="history-actions">${badge(item.risk)}<a class="text-link" href="#/recovery/${h(item.id)}">Next steps ${icon('arrow')}</a><button class="text-button destructive" data-action="delete-incident" data-id="${h(item.id)}" aria-label="Delete check from ${h(date(item.updatedAt,true))}">${icon('trash')}Delete</button></div></article>`).join('')}</div>`:`<div class="empty-state">${icon('clock')}<h2>A fresh start.</h2><p>Your call practices and message checks will appear here. Raw conversations are never saved.</p><a class="button primary" href="#/calls">Try a practice call ${icon('arrow')}</a></div>`}</section>`;
}
export function learn(state) {
  const personalized=state.consent.enabled?state.assessment?.categories.filter((c)=>c.risky>0).map((c)=>c.category)||[]:[];
  const categories=Object.entries(CATEGORIES).sort(([a],[b])=>Number(personalized.includes(b))-Number(personalized.includes(a)));
  return intro('Small habits. Stronger protection.','A practical guide to the situations that deserve a second look.')+
    `${personalized.length?'<div class="notice"><strong>Personalized using sample history.</strong> Relevant topics appear first. Standard protection always stays active.</div>':''}<div class="lesson-list">${categories.map(([id,category])=>`<details class="lesson"><summary><span class="lesson-icon">${icon(id==='family'||id==='romance'?'heart':id==='credentials'?'lock':'shield')}</span><span>${h(category.label)}${personalized.includes(id)?'<small>Relevant to your sample assessment</small>':''}</span>${icon('plus')}</summary><div class="lesson-body"><p>${h(category.advice)}</p><h3>A phrase you can use</h3><blockquote>“I’m going to pause and check this independently. I’ll call back using a number I already know.”</blockquote><div class="button-row">${contactAction(state.contact)}<a class="text-link" href="#/calls">Practice this habit ${icon('arrow')}</a></div></div></details>`).join('')}</div><div class="guide-source">More guidance from the <a href="https://consumer.ftc.gov/scams" target="_blank" rel="noopener noreferrer">Federal Trade Commission ${icon('external')}</a>.</div>`;
}
export const recoverySteps=[
  ['stop','Pause contact with the suspected scammer','Avoid sending more money, sharing more codes, or installing software.'],
  ['contact-bank','Contact the payment provider promptly','Use your bank’s official app or the number on your card. Explain what happened and ask about reversal options.'],
  ['passwords','Secure exposed accounts','Change shared passwords using the official site or app. Review account activity and sign out unfamiliar sessions.'],
  ['devices','Get help with remote access','Disconnect remote-control access and seek help from a trusted technician. Review devices and installed software.'],
  ['report','Keep records and report the incident','Save your own receipts and messages. Use the FTC’s official reporting guidance.'],
  ['trusted','Talk to your trusted person','You don’t have to handle this alone. A second person can help you work through the next steps.'],
];
export function recovery(state,ui,incidentId) {
  const topic=ui.recoveryTopic||'payment';
  const relevant=topic==='credentials'?['stop','passwords','report','trusted']:topic==='remote'?['stop','devices','passwords','report','trusted']:['stop','contact-bank','report','trusted'];
  const saved=state.incidents.find((i)=>i.id===incidentId)?.recovery || ui.recoverySteps || [];
  return intro('Let’s take the next step.','Scams can happen to anyone. You deserve practical help, without judgment.')+
    `<div class="recovery-grid"><section class="recovery-checklist"><label for="recovery-topic">What happened?</label><select id="recovery-topic"><option value="payment" ${topic==='payment'?'selected':''}>I sent money or made a payment</option><option value="credentials" ${topic==='credentials'?'selected':''}>I shared a password or code</option><option value="remote" ${topic==='remote'?'selected':''}>I allowed access to my device</option></select><div class="checklist">${recoverySteps.filter(([id])=>relevant.includes(id)).map(([id,title,copy])=>`<label class="checklist-item"><input type="checkbox" name="recovery-step" value="${id}" ${saved.includes(id)?'checked':''}><span><strong>${title}</strong><span>${copy}</span></span></label>`).join('')}</div><p class="quiet-note">${incidentId?'Your checklist progress is saved with this check.':'Open a check from Recent activity to save progress with it.'}</p></section><aside class="recovery-aside"><div class="support-note">${icon('heart')}<h2>A trusted voice helps.</h2><p>Tell someone you trust what happened. Taking a moment to ask for help is a protective habit.</p>${contactAction(state.contact)}</div><div class="simple-section"><h2>Official next steps</h2><a class="resource-link" href="https://consumer.ftc.gov/articles/what-do-if-you-were-scammed" target="_blank" rel="noopener noreferrer">FTC recovery guidance ${icon('external')}</a><a class="resource-link" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">Report fraud to the FTC ${icon('external')}</a><a class="resource-link" href="https://www.identitytheft.gov/" target="_blank" rel="noopener noreferrer">Identity theft recovery ${icon('external')}</a><p class="quiet-note">Recovery depends on the situation. T-Secure does not reverse payments or guarantee refunds.</p></div></aside></div>`;
}
export function about() {
  return intro('Clear about what we do.','T-Secure is a working prototype for recognizing warning signs and building safer habits.')+
    `<div class="about-content"><section><h2>Calls are simulated.</h2><p>The app plays fictional conversations and checks their text as they unfold. It does not listen to your phone, record audio, read your inbox, or block calls.</p></section><section><h2>Analysis sources are labeled.</h2><p>Local message checks use browser rules. Connected Firebase accounts can use Nemotron through OpenRouter. Sample profile scores use annotated fixtures in local demo mode, and Nemotron extraction in connected mode.</p></section><section><h2>Your score is a sample estimate.</h2><p>The vulnerability index is calculated from synthetic user responses to suspicious requests. It is not validated for real-world prediction. Incoming scam messages alone never raise it.</p></section><section><h2>Campaign matches use demo intelligence.</h2><p>Scam Network Intelligence compares derived indicators (sender, domains, impersonated identity, requests, tactics, and hashed wording) with a synthetic campaign dataset and your own earlier warnings. It never uses other customers’ messages and is not connected to carrier-wide data. A match explains what is shared and is never proof of a connection.</p></section><section><h2>T-Life is a concept preview.</h2><p>The preview shows the same private assessment inside a proposed T-Life experience. It is not connected to the actual T-Mobile app.</p></section><a class="button primary" href="#/home">Back to your safety space ${icon('arrow')}</a></div>`;
}
export function authView(state,ui,configured) {
  const verify=state.user && !state.user.demo && !state.user.emailVerified;
  const signup=ui.authMode==='signup',reset=ui.authMode==='reset';
  return `<main class="auth-page" id="main"><a class="brand" href="#/home"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></a><div class="auth-layout"><section class="auth-intro"><h1>A little peace<br>of mind, together.</h1><p>A space to pause, understand the warning signs, and find your next step.</p><div class="auth-trust">${icon('lock')}Private by default. Always your choice.</div><a class="text-link" href="#/home" data-action="enter-demo">Explore the local demo ${icon('arrow')}</a></section><section class="auth-panel">
    ${verify?`<span class="task-symbol pink">${icon('message')}</span><h2>Check your inbox.</h2><p>Open the verification link sent to <strong>${h(state.user.email)}</strong>, then come back here.</p><button class="button primary full" data-action="check-verification">I’ve verified my email</button><button class="button secondary full" data-action="resend-verification">Resend verification email</button><button class="text-button" data-action="logout">Use a different account</button>`:
    `<h2>${signup?'Welcome to T-Secure.':reset?'Let’s reset your password.':'Welcome back.'}</h2><p>${signup?'A few details, then you’re on your way.':reset?'We’ll send a reset link to your email.':'Sign in to your personal safety space.'}</p>
    ${!configured?'<div class="notice">Firebase isn’t connected yet. Account actions become available after project configuration. You can explore the local demo now.</div>':''}
    <form id="auth-form">${signup?'<label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="given-name" maxlength="80" required>':''}<label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required>${!reset?`<label for="auth-password">Password</label><input id="auth-password" name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required>`:''}
    ${signup?'<label class="signup-optin"><input name="advanced" type="checkbox"><span><strong>Enable advanced AI analysis</strong><small>Use sample conversations for personalized insights. Optional; starts after email verification.</small></span></label>':''}
    <button class="button primary full" type="submit" ${!configured?'disabled':''}>${signup?'Create account':reset?'Send reset link':'Sign in'}${icon('arrow')}</button></form>
    ${!reset?`<div class="auth-divider"><span>or</span></div><button class="button secondary full" data-action="google" ${!configured?'disabled':''}><span class="google-letter">G</span>Continue with Google</button>`:''}
    <div class="auth-links">${reset?'<button class="text-button" data-action="auth-mode" data-mode="login">Back to sign in</button>':signup?'Already have an account? <button class="text-button" data-action="auth-mode" data-mode="login">Sign in</button>':'<button class="text-button" data-action="auth-mode" data-mode="reset">Forgot password?</button><span>New here? <button class="text-button" data-action="auth-mode" data-mode="signup">Create an account</button></span>'}</div>`}
  </section></div></main>`;
}
