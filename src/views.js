import { h, icon, date, badge, riskLabels, highlight, contactAction } from './ui.js';
import { CATEGORIES } from '../shared/schema.js';
import { scenarios, messageSamples } from '../shared/fixtures.js';
import { analyzeConversation, TACTICS, NEXT_ACTIONS } from '../shared/prediction.js';
import { inspectLinks } from '../shared/detection.js';
import { extractIndicators, findConnections } from '../shared/network.js';
import { preferencesOf, MAX_CONTACTS } from './client.js';
import { preferenceFields, contactForm, contactList, WARNING_STYLES, VERIFICATION_METHODS, TEXT_SIZES, LANGUAGES } from './pages/onboarding.js';

const nav=[
  ['home','home','Dashboard'],['calls','phone','Call protection'],['messages','message','Check a message'],
  ['recovery','heart','Recovery Assistant'],['history','clock','Protection history'],['learn','book','Safety guide'],
];
export function shell(state,route,content,menuOpen=false) {
  const name=state.profile?.displayName || state.user?.displayName || 'Your account';
  return `<div class="app-shell">
    <aside class="sidebar ${menuOpen?'menu-open':''}" aria-label="Main navigation">
      <div class="sidebar-heading"><a class="brand" href="#/home"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></a><button class="mobile-menu-button button secondary" data-action="toggle-menu" aria-expanded="${menuOpen}" aria-controls="tsecure-navigation">${icon(menuOpen?'close':'menu')}Menu</button></div>
      <p class="brand-caption">Protecting the people behind every conversation.</p>
      <nav id="tsecure-navigation" class="primary-nav">${nav.map(([id,glyph,label])=>`<a href="#/${id}" class="nav-link ${route===id?'active':''}" ${route===id?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span>${route===id?'<span class="nav-dot"></span>':''}</a>`).join('')}</nav>
      <div class="sidebar-bottom">
        <a href="#/profile" class="nav-link ${route==='profile'?'active':''}" ${route==='profile'?'aria-current="page"':''}>${icon('person')}<span>Protection profile</span></a>
        <a href="#/settings" class="nav-link ${route==='settings'?'active':''}" ${route==='settings'?'aria-current="page"':''}>${icon('settings')}<span>Settings</span></a>
        <a href="#/t-life" aria-label="T-Life concept preview" class="nav-link ${route==='t-life'?'active':''}"><span class="t-monogram">T</span><span>T-Life preview</span>${icon('external')}</a>
        <div class="sidebar-reassurance">${icon('heart')}<p>Take your time.<br><strong>You’re in control.</strong></p></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar"><span class="workspace-label">Your safety space</span><div class="account-area"><span class="workspace-status"><span></span>${state.demo?'Demo workspace':'Protection on'}</span><a class="account-button" href="#/${state.demo?'login':'settings'}" aria-label="${state.demo?'Sign in or create an account':'Account settings'}"><span class="avatar">${h(name.charAt(0).toUpperCase())}</span><span>${state.demo?'Sign in':h(name.split(' ')[0])}</span>${icon('chevron')}</a></div></header>
      <main id="main" tabindex="-1">
        ${state.demo?`<div class="demo-note">${icon('info')}<span><strong>Interactive demo</strong><span class="demo-detail"> · Simulated calls and browser-based checks. No phone monitoring.</span></span><a href="#/about">What’s included ${icon('arrow')}</a></div>`:''}
        ${state.syncError?`<div class="notice error" role="alert">${h(state.syncError)} <button class="text-button" data-action="retry-account">Retry</button></div>`:''}
        ${content}
        <footer class="page-footer">${icon('lock')}Your pace. Your choices. Your information. · <a href="#/about">About this prototype</a> · <a href="#/developer">Developer tools</a></footer>
      </main>
    </div>
  </div>`;
}
export function intro(title,description,action='') {return `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
const channelName=(item)=>item.channel==='call'?(item.source==='simulation'?'Practice call':'Call'):item.channel==='link'?'Website address':'Text message';
const tacticLabels=(item)=>(item.tactics?.length?item.tactics.map((t)=>TACTICS[t]?.label||t):item.reasonCodes?.map((c)=>CATEGORIES[c]?.label||c))||[];
export const ACTION_LABELS={'shown':'Warning shown','viewed-verification':'Reviewed how to verify','viewed-evidence':'Reviewed the evidence','asked-for-help':'Asked for help','dismissed':'Dismissed the warning','ended-call':'Ended the call','continued':'Continued the call','called-trusted-contact':'Called a trusted contact'};
const actionFor=(state,item)=>state.warnings.find((w)=>w.incidentId===item.id);

export function home(state) {
  const p=preferencesOf(state);
  const name=(state.profile?.displayName||state.user?.displayName||'').split(' ')[0];
  const recent=state.incidents.slice(0,3);
  const warnings=state.incidents.filter((i)=>i.risk==='high').slice(0,2);
  return `<div class="home-heading"><div><h1>${name&&name!=='Demo'?'Welcome back, '+h(name)+'.':'Welcome to T-Secure.'}</h1><p>You don’t have to spot every scam alone. Let’s take a closer look, together.</p></div>
      <section class="status-card" aria-labelledby="status-title"><span class="status-dot"></span><div><h2 id="status-title">Protection is on</h2><p>${p.warningStyle==='high-only'?'Interrupting only for high risk':'Standard warnings'} · ${state.contacts.length} trusted ${state.contacts.length===1?'contact':'contacts'} · ${p.verificationMethods.length} verification ${p.verificationMethods.length===1?'method':'methods'}</p><a class="text-link" href="#/profile">View your protection profile ${icon('arrow')}</a></div></section></div>
    <section class="quick-grid" aria-label="Quick access">
      <a class="quick-tile" href="#/messages"><span class="task-symbol lilac">${icon('message')}</span><h2>Check a message</h2><p>Paste a text or link you’re unsure about.</p></a>
      <a class="quick-tile" href="#/calls"><span class="task-symbol pink">${icon('phone')}</span><h2>Call protection</h2><p>See live protection on a simulated call.</p></a>
      <a class="quick-tile" href="#/recovery"><span class="task-symbol peach">${icon('heart')}</span><h2>Recovery Assistant</h2><p>Already acted on something? Get next steps.</p></a>
      <a class="quick-tile" href="#/profile"><span class="task-symbol">${icon('person')}</span><h2>Protection profile</h2><p>Your warnings, verification, and contacts.</p></a>
    </section>
    <div class="home-grid"><div class="home-primary">
      ${warnings.length?`<section class="warning-summary" aria-labelledby="warnings-title"><h2 id="warnings-title">${icon('alert')}Recent scam warnings</h2>${warnings.map((w)=>`<a class="task-row" href="#/recovery/${h(w.id)}"><div><h3>${channelName(w)} · ${h(date(w.updatedAt,true))}</h3><p>${h(tacticLabels(w).slice(0,3).join(' · ')||'High-risk warning')}</p></div>${badge(w.risk)}</a>`).join('')}</section>`:''}
      <section class="practice-feature" aria-labelledby="practice-title"><div class="feature-copy"><h2 id="practice-title">A familiar voice.<br>An unfamiliar request.</h2><p>Watch T-Secure follow a family-emergency scam call and warn you before the money request.</p><a class="button primary" href="#/calls">Try a practice call ${icon('arrow')}</a><span class="quiet-note">About 40 seconds · No microphone needed</span></div>
      <div class="call-preview" aria-hidden="true"><div class="preview-phone"><div class="phone-notch"></div><span class="preview-avatar">${icon('person')}</span><strong>Unknown caller</strong><span class="preview-small">Simulated call</span><div class="voice-wave">${Array.from({length:19},(_,i)=>`<i style="--bar:${[12,20,32,18,40,28,46,22,35,50,30,18,42,24,36,14,28,20,12][i]}px;--delay:${i*.08}s"></i>`).join('')}</div><div class="preview-warning">${icon('shield')}<span><strong>It’s okay to pause.</strong><small>Verify before you act.</small></span></div></div><span class="preview-orbit orbit-one"></span><span class="preview-orbit orbit-two"></span></div></section>
      <section class="activity-panel" aria-labelledby="recent-title"><div class="section-topline"><h2 id="recent-title">Recent activity</h2><a class="text-link" href="#/history">View all ${icon('arrow')}</a></div>
        ${recent.length?`<ul class="activity-list">${recent.map((item)=>`<li><span class="task-symbol ${item.channel==='call'?'pink':'lilac'}">${icon(item.channel==='call'?'phone':'message')}</span><div><strong>${channelName(item)}</strong><span>${h(date(item.updatedAt,true))}</span></div>${badge(item.risk)}</li>`).join('')}</ul>`:'<p>Your checks will appear here as you use T-Secure. We save the result, never the message text.</p>'}</section>
    </div><aside class="home-aside">
      <section class="trusted-panel"><div class="section-topline"><span class="task-symbol pink">${icon('person')}</span><a class="text-link" href="#/settings#trusted-contacts">${state.contacts.length?'Manage':'Set up'} ${icon('chevron')}</a></div><h2>Your trusted people</h2>${state.contacts.length?`<p>A second opinion is just a call away.</p>${state.contacts.slice(0,2).map((c)=>`<div class="contact-summary"><span class="avatar large">${h(c.displayName.charAt(0))}</span><div><strong>${h(c.displayName)}</strong><span>${h(c.relationshipLabel||'Trusted contact')}</span></div></div>`).join('')}${contactAction(state.contact)}`:`<p>Someone you can call when a request doesn’t feel quite right.</p><a class="button secondary full" href="#/settings#trusted-contacts">${icon('plus')}Add a trusted contact</a>`}<span class="quiet-note">Always your choice. Never contacted automatically.</span></section>
      <section class="habit-note"><span class="note-pin"></span><h2>A small habit.<br> A big difference.</h2><p>Hang up. Then call back using a number you already know.</p><a class="text-link" href="#/learn">Explore the safety guide ${icon('arrow')}</a></section>
    </aside></div>
    <section class="journey-strip" aria-label="Three levels of protection"><div><span>Before</span><strong>Check and prepare</strong></div>${icon('arrow')}<div><span>During</span><strong>Pause and verify</strong></div>${icon('arrow')}<div><span>After</span><strong>Find your next step</strong></div></section>`;
}
export function calls(state,ui) {
  const p=preferencesOf(state);
  return intro('Live call protection','Watch a conversation unfold. T-Secure follows the manipulation as it builds and warns you before the risky step.')+
  `<div class="call-toolbar"><label for="scenario">Demonstration scenario<select id="scenario" ${['playing','paused'].includes(ui.call.status)?'disabled':''}>${scenarios.map((s)=>`<option value="${s.id}" ${ui.scenario===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></label><span class="simulation-label">${icon('info')}Simulated live call · Scripted transcript · No phone connected</span></div>
  <div class="call-preparation"><div class="call-audio-control"><label for="call-alert-audio">Warning sound</label><select id="call-alert-audio"><option value="visual" ${p.callAlertAudio==='visual'?'selected':''}>Visual warnings only</option><option value="tone" ${p.callAlertAudio==='tone'?'selected':''}>Visual + gentle tone</option><option value="speech" ${p.callAlertAudio==='speech'?'selected':''}>Visual + spoken guidance</option></select></div>
    <label class="choice inline"><input type="checkbox" id="call-voice" ${ui.callVoice?'checked':''}><span><strong>Play synthetic voices</strong><small>Your browser’s text-to-speech reads the scripted lines. Not a recording of a real person.</small></span></label>
    <p class="field-help">One warning per risk level, per call. <span id="call-audio-status" role="status">${ui.audioUnavailable?'Audio is unavailable. Visual warnings remain active.':''}</span></p></div>
  <div id="call-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div><div id="call-workspace">${callWorkspace(state,ui)}</div>`;
}
export const lowerFirst=(text='')=>text.charAt(0).toLowerCase()+text.slice(1);
export function effectiveRisk(snapshot) {
  const level=snapshot.insight?.level||'low',risk=snapshot.analysis?.risk||'low';
  const rank={low:0,unknown:0,caution:1,high:2};
  return rank[level]>rank[risk]?level:risk;
}
export const formatDuration=(ms=0)=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
// Warning types used for headings and the warnings log.
export function warningTypeOf(prediction) {
  return ({credentials:'account-takeover',support:'remote-access',delivery:'payment-card'})[prediction?.pattern]||(prediction?'financial':'general');
}
const WARNING_TITLES={financial:'Potential financial scam','account-takeover':'Potential account takeover','remote-access':'Potential remote-access scam','payment-card':'Potential payment-card scam',general:'Pause and verify this caller'};
const verifyGuidance={
  bank:'Call the number on the back of your card, or open your bank’s official app. Your bank will never ask you to move money or share a code.',
  delivery:'Open the carrier’s official app, or type its website yourself, and enter the tracking number from your receipt.',
  government:'Look up the agency’s official number on its .gov website. Agencies send letters first and never demand gift cards or crypto.',
  family:'Hang up and call them on the number already saved in your phone, even if the voice sounds right.',
  romance:'Talk it over with someone you trust. Never send money to someone you haven’t met in person.',
  support:'Contact the company through its official website, typed in yourself. Real support teams don’t call unexpectedly.',
};
export function verificationSteps(state,pattern) {
  const p=preferencesOf(state);
  const copy={
    callback:verifyGuidance[pattern]||'Hang up. Call back on a number you already have saved, not one the caller gives you.',
    passphrase:p.hasFamilyPassphrase?'Ask for your family passphrase. If they can’t give it, hang up.':'Ask something only the real person would know. Consider setting up a family passphrase later.',
    'other-channel':'Check through another channel: text or video call them on their usual account.',
    'ask-family':'Ask another family member to check on them directly.',
  };
  const order=[...p.verificationMethods,...VERIFICATION_METHODS.map(([v])=>v).filter((v)=>!p.verificationMethods.includes(v))];
  const relational=['family','romance',undefined].includes(pattern);
  return order.filter((m)=>relational||m==='callback').map((m)=>copy[m]);
}
export function callWarningDialog(snapshot,state,panel=null) {
  const prediction=snapshot.insight?.prediction;
  const type=warningTypeOf(prediction);
  const tactics=[...new Map((snapshot.insight?.findings||[]).map((f)=>[f.tactic,f])).values()];
  const panels={
    verify:`<div class="warning-panel" id="warning-panel" tabindex="-1"><h3>How to verify this person</h3><ol>${verificationSteps(state,prediction?.pattern).map((s)=>`<li>${h(s)}</li>`).join('')}</ol><p class="privacy-footnote">A familiar voice is not proof. Voices and caller ID can be imitated.</p></div>`,
    evidence:`<div class="warning-panel" id="warning-panel" tabindex="-1"><h3>What T-Secure noticed</h3><ul class="call-warning-evidence">${tactics.map((f)=>`<li><strong>${h(f.label)}</strong><blockquote>“${h(f.excerpt)}”</blockquote><p>${h(f.explanation)}</p></li>`).join('')}${(snapshot.insight?.requests||[]).map((r)=>`<li><strong>Request: ${h(r.label)}</strong><blockquote>“${h(r.excerpt)}”</blockquote></li>`).join('')}</ul></div>`,
    help:`<div class="warning-panel" id="warning-panel" tabindex="-1"><h3>Help is here</h3><p>You can end the call now. Nothing bad happens if you hang up on a real person. They can call back.</p><div class="button-row">${state.contacts.map((c)=>`<a class="button secondary" data-action="call-contact" href="tel:${h(c.phone.replace(/[^+\d]/g,''))}">${icon('phone')}Call ${h(c.displayName)}</a>`).join('')||`<a class="button secondary" href="#/settings#trusted-contacts">${icon('plus')}Add a trusted contact</a>`}<a class="button secondary" href="#/recovery" data-action="open-recovery">${icon('heart')}Already sent money or a code?</a></div><p class="quiet-note">If you are being threatened or feel unsafe, call 911.</p></div>`,
  };
  return `<div class="call-warning-heading"><h2 id="call-warning-title">${icon('alert')}${h(WARNING_TITLES[type])}</h2><button class="dialog-close" data-action="dismiss-warning" aria-label="Dismiss warning">${icon('close')}</button></div>
    <div class="call-warning-body" role="region" aria-label="Warning details" tabindex="0"><p id="call-warning-copy">This conversation contains ${tactics.length>1?'multiple indicators':'an indicator'} of manipulation. The practice call is paused.</p>
    ${tactics.length?`<h3 class="dialog-subhead">Detected</h3><ul class="detected-list">${tactics.map((f)=>`<li>${icon('check')}${f.tactic==='trust'&&prediction?.pattern==='family'?'Possible family impersonation':h(f.label)}</li>`).join('')}</ul>`:''}
    ${prediction?`<div class="dialog-prediction"><span>${icon('spark')}Potential next action · ${h(prediction.strengthLabel)}</span><strong>${prediction.confirmed?`They asked you to ${h(lowerFirst(prediction.confirmed.label))}. Next, they may ${h(lowerFirst(prediction.followUp))}.`:`The caller may ${h(lowerFirst(prediction.action))}.`}</strong><small>${h(prediction.uncertainty)}</small></div>`:''}
    <div class="dialog-recommendation">${icon('shield')}<p><strong>Recommended:</strong> ${h(prediction?.advice||'Hold off on sharing codes or sending money. Call back using a number you already trust.')}</p></div>
    ${panel?panels[panel]:''}</div>
    <div class="warning-actions" role="group" aria-label="Warning options">
      <button class="button secondary" data-action="warning-panel" data-panel="verify" aria-expanded="${panel==='verify'}" aria-controls="warning-panel">${icon('phone')}How do I verify this person?</button>
      <button class="button secondary" data-action="warning-panel" data-panel="evidence" aria-expanded="${panel==='evidence'}" aria-controls="warning-panel">${icon('book')}Show detected evidence</button>
      <button class="button secondary" data-action="warning-panel" data-panel="help" aria-expanded="${panel==='help'}" aria-controls="warning-panel">${icon('heart')}I need help</button>
      <button class="button secondary" data-action="dismiss-warning">Dismiss warning</button>
    </div>
    <div class="call-warning-actions"><button class="button danger" data-action="end-call">${icon('phone')}End demo call</button><button class="text-button" data-action="continue-call">Continue the demo call</button></div>`;
}
export function callWorkspace(state,ui) {
  const snapshot=ui.call;
  const active=['playing','paused'].includes(snapshot.status);
  const scenario=scenarios.find((s)=>s.id===ui.scenario)||scenarios[0];
  const analysis=snapshot.analysis;
  const labels={idle:'Ready when you are',playing:'Live · analyzing',paused:'Paused',ended:'Call ended',completed:'Call complete'};
  const quietCaution=preferencesOf(state).warningStyle==='high-only';
  const alert=active&&snapshot.alert&&!(snapshot.alert.risk==='caution'&&quietCaution)?snapshot.alert:null;
  const prediction=snapshot.insight?.prediction;
  const risk=effectiveRisk(snapshot);
  const marks=[...analysis.reasons,...(snapshot.insight?.findings||[]).map(f=>({evidence:f.excerpt}))];
  const transcript=snapshot.turns.map(t=>t.speaker+': '+t.text).join('\n');
  const connections=snapshot.turns.length&&risk!=='low'?findConnections(extractIndicators({text:transcript,sender:scenario.number}),{incidents:state.incidents,excludeId:snapshot.sessionId}):null;
  return `${alert?`<section class="call-live-alert ${h(alert.risk)}" aria-label="Current call warning">${icon('alert')}<div><strong>${h(riskLabels[alert.risk])} · Pause and verify</strong><p>${alert.predictive&&prediction?'The caller may '+h(lowerFirst(prediction.action))+'. Verify before you act.':alert.risk==='high'?'Verify the caller before sharing information or sending money.':'Pressure or urgency deserves a second look.'}</p></div><button class="text-button" data-action="${alert.risk==='high'?'review-call-warning':'pause-to-verify'}">${alert.risk==='high'?'Review warning':'Pause to verify'}</button></section>`:''}
  <div class="call-grid"><section class="conversation-panel"><div class="call-person"><span class="call-avatar">${h(scenario.initials)}</span><div><h2>${h(scenario.caller)}</h2>${scenario.number?`<span class="call-number">${h(scenario.number)}</span>`:''}<span class="call-claim">${icon('info')}Identity claim: ${h(scenario.claim||'None')} · <em>unverified</em></span><span class="call-state"><i class="${snapshot.status==='playing'?'pulsing':''}"></i>${labels[snapshot.status]} · <span id="call-timer" aria-label="Call duration">${formatDuration(ui.callElapsed)}</span></span></div><span class="small-chip">${snapshot.turns.length?h(riskLabels[risk]):'Simulated call'}</span></div>
    <div class="transcript" role="log" tabindex="0" aria-label="Live transcript" aria-live="off">${snapshot.turns.length?`<ol>${snapshot.turns.map((t)=>`<li class="turn ${t.speaker}"><span>${t.speaker==='contact'?'Caller':'You · sample response'}${t.timestamp&&snapshot.turns[0]?.timestamp?' · '+formatDuration(new Date(t.timestamp)-new Date(snapshot.turns[0].timestamp)):''}</span><p>${highlight(t.text,marks)}</p></li>`).join('')}</ol>`:`<div class="transcript-empty">${icon('headphones')}<h3>${h(scenario.name)}</h3><p>${h(scenario.description)}</p><p class="quiet-note">The transcript appears line by line, as if it were being transcribed live. Nothing is recorded or connected to your phone.</p></div>`}</div>
    <div class="call-controls">${active?`<button class="button secondary" data-action="${snapshot.status==='paused'?'resume':'pause'}">${icon(snapshot.status==='paused'?'play':'pause')}${snapshot.status==='paused'?'Resume':'Pause'}</button><button class="button secondary" data-action="restart-call">${icon('refresh')}Restart</button><button class="button danger" data-action="end-call">${icon('phone')}End demo call</button>`:`<button class="button primary" data-action="start-call">${icon('play')}${snapshot.status==='idle'?'Start simulated call':'Play again'}</button><span class="quiet-note">${snapshot.status==='idle'?'You can pause, restart, or end at any time.':'You stayed in control. That’s the habit.'}</span>`}</div></section>
    <aside class="call-guidance" tabindex="-1">${analysisPanel({...analysis,risk,score:snapshot.insight?.score},state,true)}${snapshot.turns.length?predictionCard(snapshot):''}${connections&&(connections.campaigns.length||connections.history.length)?networkPanel(connections,state):''}<div class="simple-note">${icon('lock')}<p>Voices and caller names can be imitated. Use a saved number to verify independently.</p></div></aside></div>
    ${snapshot.turns.length?manipulationTimeline(snapshot):''}
    ${!active&&snapshot.turns.length?`<section class="call-followup"><h2>After the call, take your next step.</h2><p>${risk==='high'?'If you shared information or sent money, the Recovery Assistant can help right away.':'Keep practicing an independent callback before acting on unexpected requests.'}</p><div class="button-row"><a class="button primary" href="#/recovery${snapshot.sessionId?'/'+h(snapshot.sessionId):''}">Open the Recovery Assistant ${icon('arrow')}</a><a class="text-link" href="#/learn">Build a safer habit ${icon('book')}</a></div></section>`:''}`;
}
export function predictionCard(snapshot) {
  const prediction=snapshot.insight?.prediction;
  if(!prediction||(prediction.strength==='possible'&&snapshot.insight.level==='low'))return `<section class="prediction-card quiet" aria-label="Predicted next step"><span class="prediction-eyebrow">${icon('spark')}What may come next</span><p>Watching how the conversation develops. No harmful request is predicted so far.</p></section>`;
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
  return `<section class="manipulation-timeline" aria-labelledby="timeline-title"><div class="timeline-heading"><h2 id="timeline-title">Manipulation timeline</h2><p>Each tactic we noticed, in order. Based only on the words used, never a judgment of who is calling.</p></div>
    <ol class="timeline">${turns.map(turn=>{
      const here=findings.filter(f=>f.turn===turn),asked=requests.filter(r=>r.turn===turn);
      const time=here[0]?.time;
      return `<li class="timeline-step ${asked.length?'request':''}"><span class="timeline-marker"></span><div class="timeline-meta">${time?h(time)+' · ':''}Turn ${turn}</div>
        ${here.map(f=>`<div class="timeline-finding"><div class="timeline-finding-head"><strong>${f.tactic==='trust'&&snapshot.insight.prediction?.pattern==='family'?'Possible family impersonation':h(f.label)}</strong><span class="confidence ${h(f.confidence)}">${h(f.confidence)} confidence</span></div><blockquote>“${h(f.excerpt)}”</blockquote><p>${h(f.explanation)}</p></div>`).join('')}
        ${asked.map(r=>`<div class="timeline-request">${icon('alert')}<p><strong>Request: ${h(r.label)}</strong> “${h(r.excerpt)}”</p></div>`).join('')}
        ${snapshot.predictedAt?.turn===turn?`<div class="timeline-predicted">${icon('spark')}<p><strong>Prediction made:</strong> the caller may ${h(lowerFirst(snapshot.predictedAt.action))}.</p></div>`:''}</li>`;
    }).join('')}</ol></section>`;
}
function sourceLabel(analysis,state) {
  if(state.demo)return 'Rule-based checks in your browser · Demo mode';
  if(analysis?.analysisSource==='hybrid')return h(analysis.provider?.label||'AI')+' + independent rule checks';
  if(analysis?.provider?.id==='rules')return 'Independent rule checks (no AI provider configured)';
  return 'Independent rule checks';
}
export function analysisPanel(analysis,state,call=false) {
  const risk=analysis?.risk||'low';
  return `<section class="analysis-panel ${h(risk)}"><span class="analysis-symbol">${icon(risk==='high'||risk==='caution'?'alert':risk==='unknown'?'info':'shield')}</span><span class="assessment-eyebrow">Risk level${typeof analysis?.score==='number'?` · evidence score ${analysis.score}/100`:''}</span><h2>${h(riskLabels[risk])}</h2><p>${risk==='high'?'Serious warning signs. Pause before sharing information or sending money.':risk==='caution'?'A few things deserve a second look. Take your time and verify independently.':risk==='unknown'?'AI analysis is unavailable or the context is incomplete. Keep verifying independently.':'No clear warning so far. Independent verification is still a good habit.'}</p>
    ${analysis?.reasons?.length?`<ul class="reason-list">${analysis.reasons.slice(-4).map((reason)=>`<li><strong>${h(CATEGORIES[reason.code]?.label||'Warning sign')}</strong><blockquote>“${h(reason.evidence)}”</blockquote></li>`).join('')}</ul>`:''}
    ${['high','caution','unknown'].includes(risk)?`<div class="guidance-actions">${contactAction(state.contact)}<a class="text-link" href="#/learn">View warning signs ${icon('arrow')}</a>${!call?'<a class="text-link" href="#/recovery">Already acted on it? Find next steps.</a>':''}</div>`:''}
    <div class="analysis-source">${icon('info')}${sourceLabel(analysis,state)}</div>${analysis?.incomplete?'<p class="incomplete-note">AI analysis could not finish. Rule-based warnings remain active.</p>':''}</section>`;
}
function checkedAnalysis(ui) {
  const checked=ui.messageChecked;
  if(!checked||!ui.messageResult)return null;
  const insight=analyzeConversation([{speaker:'contact',text:checked.text}]);
  const rank={low:0,unknown:0,caution:1,high:2};
  const risk=rank[insight.level]>rank[ui.messageResult.risk]?insight.level:ui.messageResult.risk;
  return {checked,insight,risk};
}
const ORG_CLAIMS={family:'A family member',romance:'A romantic partner',bank:'Your bank',government:'A government agency',support:'Technical support',delivery:'A delivery company'};
function messageAssessment(result,insight,risk,state) {
  const tactics=[...new Map(insight.findings.map(f=>[f.tactic,f])).values()];
  const indicators=[...insight.requests.map(r=>({label:'Request: '+r.label,evidence:r.excerpt})),...tactics.map(f=>({label:f.label,evidence:f.excerpt})),...result.reasons.map(r=>({label:CATEGORIES[r.code]?.label||'Warning sign',evidence:r.evidence}))]
    .filter((item,i,all)=>all.findIndex(other=>other.evidence===item.evidence)===i).slice(0,6);
  const request=insight.requests[0];
  const why=risk==='high'?`${request?'It asks you to '+h(lowerFirst(request.label)):'It follows a known scam pattern'}${tactics.length?', alongside '+tactics.length+' pressure '+(tactics.length===1?'tactic':'tactics'):''}. Together, these are strong warning signs.`
    :risk==='caution'?'Some warning signs are present, but not enough to be sure. Verify before you act on it.'
    :risk==='unknown'?'AI analysis could not finish and the rule checks found nothing clear. Keep verifying independently.'
    :'No request for money, codes, or personal details, and no pressure tactics. A single word on its own is never enough to flag a message.';
  const score=result.report?.risk_score??insight.score;
  return `<section class="analysis-panel message-assessment ${h(risk)}" aria-labelledby="assessment-title"><span class="analysis-symbol">${icon(risk==='high'||risk==='caution'?'alert':risk==='unknown'?'info':'shield')}</span>
    <span class="assessment-eyebrow">Risk level · evidence score ${h(score)}/100</span><h2 id="assessment-title">${h(riskLabels[risk])}</h2><p>${why}</p>
    ${insight.orgs.length?`<p class="impersonation-note">${icon('person')}<span><strong>Claims to be:</strong> ${h(insight.orgs.map((o)=>ORG_CLAIMS[o]||o).join(', '))}. Anyone can claim this. Verify through a contact you find yourself.</span></p>`:''}
    ${indicators.length?`<h3 class="assessment-subhead">Suspicious indicators</h3><ul class="reason-list">${indicators.map(item=>`<li><strong>${h(item.label)}</strong><blockquote>“${h(item.evidence)}”</blockquote></li>`).join('')}</ul>`:''}
    ${result.report?.model_explanation?`<p class="model-explanation"><strong>AI explanation:</strong> ${h(result.report.model_explanation)}</p>`:''}
    <div class="recommended">${icon('shield')}<p><strong>Recommended:</strong> ${h(result.report?.recommended_action||(insight.prediction?.advice)||'Verify independently before acting.')}</p></div>
    <div class="analysis-source">${icon('info')}${sourceLabel(result,state)}. ${result.analysisSource==='hybrid'?'AI can raise a rating by one level at most.':''}</div>${result.incomplete?'<p class="incomplete-note">AI analysis could not finish. Rule-based warnings remain active.</p>':''}</section>`;
}
function linkInspection(text) {
  const {links,mentionsLinkWithoutUrl}=inspectLinks(text);
  if(!links.length&&!mentionsLinkWithoutUrl)return '';
  return `<section class="link-inspection" aria-labelledby="links-title"><h2 id="links-title">${icon('external')}Links in this message</h2>
    ${mentionsLinkWithoutUrl?'<p>The message refers to a link. Whatever its address, don’t use links from unexpected messages. Go to the official app or type the website yourself.</p>':''}
    <ul>${links.map((l)=>`<li><code>${h(l.url)}</code><span>Website: <strong>${h(l.host)}</strong></span>${l.flags.length?`<ul class="link-flags">${l.flags.map((f)=>`<li class="${h(f.severity)}">${icon('alert')}${h(f.label)}</li>`).join('')}</ul>`:'<p class="quiet-note">No structural warning signs in the address itself. A clean-looking address can still be fake.</p>'}</li>`).join('')}</ul>
    <p class="privacy-footnote">${icon('lock')}Links are checked as text. T-Secure never opens them.</p></section>`;
}
function messageBreakdown(text,insight) {
  const ordered=[...insight.findings].sort((a,b)=>a.index-b.index);
  return `<section class="manipulation-timeline" id="message-breakdown" tabindex="-1" aria-labelledby="breakdown-title"><div class="timeline-heading"><h2 id="breakdown-title">Message manipulation breakdown</h2><p>The tactics in this one message, in the order they appear.</p></div>
    <blockquote class="breakdown-message">${highlight(text,[...ordered.map(f=>({evidence:f.excerpt})),...insight.requests.map(r=>({evidence:r.excerpt}))])}</blockquote>
    ${ordered.length||insight.requests.length?`<ol class="timeline">${ordered.map(f=>`<li class="timeline-step"><span class="timeline-marker"></span><div class="timeline-finding"><div class="timeline-finding-head"><strong>${h(f.label)}</strong><span class="confidence ${h(f.confidence)}">${h(f.confidence)} confidence</span></div><blockquote>“${h(f.excerpt)}”</blockquote><p>${h(f.explanation)}</p></div></li>`).join('')}${insight.requests.map(r=>`<li class="timeline-step request"><span class="timeline-marker"></span><div class="timeline-request">${icon('alert')}<p><strong>Request: ${h(r.label)}</strong> “${h(r.excerpt)}”</p></div></li>`).join('')}</ol>`:'<p class="breakdown-empty">No manipulation tactics found in this message.</p>'}</section>`;
}
function messagePrediction(insight) {
  const prediction=insight.prediction;
  if(!prediction||prediction.strength==='possible')return `<section class="prediction-card quiet" aria-labelledby="next-title"><span class="prediction-eyebrow">${icon('spark')}<span id="next-title">What might happen next?</span></span><p>T-Secure can’t confidently predict a next step from this message. There isn’t enough evidence. If the sender follows up asking for money, codes, or personal details, check that message too.</p></section>`;
  const filled={possible:1,likely:2,strong:3}[prediction.strength];
  const asked=prediction.confirmed;
  return `<section class="prediction-card ${h(prediction.strength)}" aria-labelledby="next-title"><div class="prediction-top"><span class="prediction-eyebrow">${icon('spark')}<span id="next-title">What might happen next?</span></span><span class="likelihood">${h(prediction.strengthLabel)}</span></div>
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
  return `<section class="network-panel" aria-labelledby="network-title"><div class="network-heading"><div><span class="prediction-eyebrow">${icon('shield')}Engine 5 · Future capability</span><h2 id="network-title">Scam Network Intelligence</h2></div><span class="small-chip">Synthetic demo data</span></div>
    ${!campaigns.length&&!history.length?'<p class="network-empty">No connection found to the demo campaign dataset or your earlier checks. That alone doesn’t mean it’s safe.</p>':''}
    ${campaigns.map(c=>`<article class="network-match ${h(c.strength)}"><div class="prediction-top"><h3>Possible campaign: ${h(c.name)}</h3><span class="likelihood">${h(c.strengthLabel)}</span></div>${meter(c.strength)}<p>${h(c.summary)}</p><h4>What connects them</h4>${shared(c.shared)}
      <details class="network-related"><summary>View related indicators ${icon('plus')}</summary><ul>${c.related.map(([type,value,why])=>`<li><strong>${h(type)}: ${h(value)}</strong><span>${h(why)}</span></li>`).join('')}</ul></details></article>`).join('')}
    ${history.length?`<h3 class="network-subhead">Similar to your earlier checks</h3>${history.map(m=>`<article class="network-match ${h(m.strength)}"><div class="prediction-top"><h3>${m.channel==='call'?'Practice call':'Message check'} · ${h(date(m.updatedAt,true))}</h3><span class="likelihood">${h(m.strengthLabel)}</span></div>${meter(m.strength)}${shared(m.shared)}</article>`).join('')}`:''}
    <p class="prediction-uncertainty">${icon('info')}${h(connections.uncertainty)} Campaigns are a synthetic demo dataset${state.demo?'':' plus your own saved checks'}, not carrier-wide data. Other customers’ messages are never used.</p></section>`;
}
function messageActions(insight,risk,result,state) {
  const org=insight.orgs[0];
  const saved=result.sessionId;
  return `<section class="message-actions" aria-label="What you can do"><h2>What you can do</h2><div class="action-list">
    <details class="action-disclosure"><summary>${icon('phone')}How do I verify this?</summary><div><p>${h(verifyGuidance[org]||'Contact the organization or person using a phone number or website you find yourself, not one from the message.')}</p><p>Don’t reply, call numbers, or tap links in the message itself.</p></div></details>
    <button class="action-disclosure-button" data-action="show-evidence">${icon('book')}Show evidence</button>
    <details class="action-disclosure"><summary>${icon('arrow')}What should I do next?</summary><div><ol class="next-steps">${(risk==='high'?['Don’t reply or tap any links.','Verify independently using a number you already trust.','Report the message, then delete it.','Talk to your trusted person if you feel unsure.']:risk==='caution'?['Pause before acting on the request.','Verify independently using a number you already trust.','If it still feels wrong, report it.']:['No clear warning signs, but stay alert to follow-up requests.','If anyone asks for money, codes, or personal details, verify first.']).map(s=>`<li>${h(s)}</li>`).join('')}</ol><a class="text-link" href="#/recovery">Already replied, paid, or shared a code? Open the Recovery Assistant ${icon('arrow')}</a></div></details>
    <details class="action-disclosure"><summary>${icon('alert')}Report or mark as suspicious</summary><div><p><strong>Forward the text to 7726</strong> (spells “SPAM”). It’s free, and it helps mobile carriers block similar messages.</p><p>Block the sender in your messages app, then delete the message.</p><a class="resource-link" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">Report fraud to the FTC ${icon('external')}</a></div></details>
    <details class="action-disclosure"><summary>${icon('clock')}Saved to protection history</summary><div>${result.saved===false?'<p>We couldn’t save this check right now. The results on this page are still complete.</p>':saved?`<p>${icon('check')} Saved. ${['caution','high'].includes(risk)?'We keep the warning categories and derived indicators (like domains and sender), never the message text.':'For ordinary messages we keep only the result, never the text or sender.'}</p><a class="text-link" href="#/history">View protection history ${icon('arrow')}</a>`:`<p>${state.demo?'Saving…':'Finishing the check…'}</p>`}</div></details>
  </div></section>`;
}
export function messages(state,ui) {
  const analysis=checkedAnalysis(ui);
  const connections=analysis?findConnections(extractIndicators(analysis.checked),{incidents:state.incidents,excludeId:ui.messageResult.sessionId}):null;
  return intro('SMS and link scanner','Paste a suspicious text or website address. We’ll explain the warning signs and what to do next.')+
  `<div class="message-grid"><section class="form-panel"><form id="message-form"><label for="message-text">Message or website address</label><textarea id="message-text" name="text" rows="7" maxlength="12000" placeholder="Paste the message here. You don’t need to open any links." required>${h(ui.messageText)}</textarea><div class="input-meta"><span>Keep personal details out when possible.</span><span>12,000 character limit</span></div><label for="message-sender">Who sent it? <span class="optional-label">Optional</span></label><input id="message-sender" name="sender" maxlength="40" autocomplete="off" value="${h(ui.messageSender)}" placeholder="Phone number or sender name"><p class="field-help">Helps spot repeated senders across your checks.</p><button class="button primary" type="submit" ${ui.messageBusy?'disabled':''}>${icon(ui.messageBusy?'refresh':'shield')}${ui.messageBusy?'Checking…':'Analyze message'}</button></form><div class="sample-options"><p>Or try an example</p>${messageSamples.map((s,i)=>`<button class="sample-button" data-action="message-sample" data-index="${i}">${h(s.name)}${icon('plus')}</button>`).join('')}</div></section><aside>${analysis?messageAssessment(ui.messageResult,analysis.insight,analysis.risk,state):`<div class="checking-empty">${icon('message')}<h2>A little context helps.</h2><p>Include what the sender is asking you to do. We’ll check the language and the structure of any links.</p><div class="simple-note">${icon('lock')}<p>Submitted links stay as text. We never open them.</p></div></div>`}</aside></div>
  ${analysis?`<div class="message-insights">${linkInspection(analysis.checked.text)}${messageActions(analysis.insight,analysis.risk,ui.messageResult,state)}<div class="insight-grid">${messageBreakdown(analysis.checked.text,analysis.insight)}<div class="insight-side">${messagePrediction(analysis.insight)}${networkPanel(connections,state)}</div></div></div>`:''}
  <p class="privacy-footnote">${state.demo?'In this demo, messages are checked with rules in your browser. Signed-in accounts can add AI analysis on the server.':'Submitted text is sent through our secure API for rule checks and, when configured, AI analysis. Raw message text is not saved.'}</p>`;
}
export function profileSummary(state) {
  const p=preferencesOf(state);
  const style=WARNING_STYLES.find(([v])=>v===p.warningStyle);
  return `<div class="profile-grid">
    <section class="settings-section"><div class="section-heading">${icon('shield')}<div><h2>Warnings</h2><p>${h(style?.[1])}</p></div></div><p>${h(style?.[2])}</p><p class="field-help">Warning sound: ${h({visual:'Visual only',tone:'Gentle tone',speech:'Spoken guidance'}[p.callAlertAudio])}</p></section>
    <section class="settings-section"><div class="section-heading">${icon('phone')}<div><h2>How you verify callers</h2><p>Shown first when a warning appears.</p></div></div><ul class="check-list">${p.verificationMethods.length?p.verificationMethods.map((m)=>`<li>${icon('check')}${h(VERIFICATION_METHODS.find(([v])=>v===m)?.[1])}</li>`).join(''):'<li>No preference chosen yet.</li>'}</ul><p class="field-help">${p.hasFamilyPassphrase?'You have a family passphrase. We never store it.':'No family passphrase set up. Consider agreeing on one with your family.'}</p></section>
    <section class="settings-section"><div class="section-heading">${icon('person')}<div><h2>Trusted contacts</h2><p>Optional. Never contacted automatically.</p></div></div>${state.contacts.length?contactList(state.contacts).replace(/<button[\s\S]*?<\/button>/g,''):'<p>No trusted contacts yet.</p>'}</section>
    <section class="settings-section"><div class="section-heading">${icon('settings')}<div><h2>Display and language</h2><p>Applied across T-Secure.</p></div></div><p>Text size: ${h(TEXT_SIZES.find(([v])=>v===p.textSize)?.[1])} · ${p.highContrast?'High contrast':'Standard contrast'} · ${p.reduceMotion?'Reduced motion':'Standard motion'}</p><p class="field-help">Language: ${h(LANGUAGES.find(([v])=>v===p.language)?.[1])}</p></section>
  </div><div class="button-row"><a class="button primary" href="#/settings">${icon('settings')}Change preferences</a></div>
  <p class="privacy-footnote">${icon('lock')}This profile customizes protection. It never scores, ranks, or judges you.</p>`;
}
export function profile(state,tLife=false) {
  return tLife?intro('Your T-Life profile preview.','A concept of how the same Protection Profile could appear inside T-Life.')+
    `<section class="t-life-shell"><header class="t-life-header"><span class="t-life-logo">T<span>Life</span></span><span class="small-chip">Concept demo</span></header><nav class="t-life-crumb" aria-label="T-Life preview breadcrumb"><span>Manage</span>${icon('chevron')}<span>T-Secure</span>${icon('chevron')}<strong>Protection profile</strong></nav><div class="t-life-body">${profileSummary(state)}</div><p class="t-life-disclaimer">A web prototype for a possible future integration. It does not connect to or modify the actual T-Life app, and T-Mobile has not approved it.</p></section>`:
    intro('Your Personal Protection Profile','How T-Secure warns you, how you prefer to verify callers, and who you trust.')+profileSummary(state);
}
export function settings(state) {
  const p=preferencesOf(state);
  const fields=preferenceFields(p,{withName:true,name:state.profile?.displayName||state.user?.displayName||''});
  return intro('Settings','Choose what feels right for you. You can change your mind anytime.')+
  `<div class="settings-grid"><div>
    <section class="settings-section" aria-labelledby="protection-heading"><div class="section-heading">${icon('shield')}<div><h2 id="protection-heading">Warning and verification preferences</h2><p>Warnings are always proportional to the evidence.</p></div></div><form id="preferences-form" data-section="protection">${fields.protection}<button class="button primary" type="submit">Save preferences</button></form></section>
    <section class="settings-section" aria-labelledby="access-heading"><div class="section-heading">${icon('person')}<div><h2 id="access-heading">Profile, accessibility, and language</h2><p>Display changes apply right away.</p></div></div><form id="preferences-form-access" data-section="accessibility">${fields.accessibility}<button class="button primary" type="submit">Save preferences</button></form></section>
    <section class="settings-section" id="trusted-contacts" aria-labelledby="contacts-heading"><div class="section-heading">${icon('heart')}<div><h2 id="contacts-heading">Trusted contacts</h2><p>Up to ${MAX_CONTACTS} people you can call for a second opinion.</p></div><span class="small-chip">Optional</span></div>${contactList(state.contacts)}${state.contacts.length<MAX_CONTACTS?contactForm('settings'):''}<p class="privacy-footnote">Never contacted automatically. A saved contact does not prove who an incoming caller is.</p></section>
  </div>
  <aside class="settings-aside">
    <section class="simple-section"><h2>Privacy controls</h2><p>We save preferences, trusted contacts, and a summary of each check: date, risk level, warning categories, and what you chose to do. Raw messages and transcripts are never saved.</p><p>${state.incidents.length} ${state.incidents.length===1?'check':'checks'} and ${state.warnings.length} warning ${state.warnings.length===1?'record':'records'} saved.</p><button class="button secondary" data-action="delete-history" ${!state.incidents.length&&!state.warnings.length?'disabled':''}>${icon('trash')}Delete all history</button><a class="text-link" href="#/about">About this prototype ${icon('arrow')}</a></section>
    <section class="simple-section account-settings"><h2>Account</h2><p>${state.demo?'You’re exploring the demo. Your settings stay in this browser.':h(state.user.email)}</p>${state.demo?'<a class="button secondary" href="#/login">Sign in or create account</a><button class="button secondary" data-action="logout">Leave the demo</button>':`<button class="button secondary" data-action="logout">${icon('logout')}Sign out</button>`}
      <details class="danger-zone"><summary>${state.demo?'Reset the demo':'Delete my account'}</summary><p>${state.demo?'Removes demo preferences, contacts, and history from this browser.':'Permanently deletes your profile, trusted contacts, history, and sign-in. This cannot be undone.'}</p><button class="button danger" data-action="delete-account">${icon('trash')}${state.demo?'Reset demo':'Delete account permanently'}</button></details></section>
  </aside></div>`;
}
export function history(state) {
  return intro('Protection history','The checks and warnings in your account. We keep the result, never the message or transcript.',state.incidents.length?'<button class="button secondary" data-action="delete-history">'+icon('trash')+'Delete all</button>':'')+
    `<section class="history-section">${state.incidents.length?`<div class="history-list">${state.incidents.map((item)=>{const warning=actionFor(state,item);return `<article class="history-row"><span class="task-symbol ${item.channel==='call'?'pink':'lilac'}">${icon(item.channel==='call'?'phone':'message')}</span><div class="history-main"><h2>${channelName(item)}</h2><span>${date(item.updatedAt,true)}${typeof item.riskScore==='number'?' · evidence score '+item.riskScore+'/100':''}</span><p>${h(tacticLabels(item).join(' · ')||'No warning indicators recorded.')}</p>${item.predictedAction?`<p class="history-detail">${icon('spark')}Predicted next step: ${h(NEXT_ACTIONS[{potential_payment_request:'payment',potential_verification_code_request:'credentials',potential_remote_access_request:'remote',potential_malicious_link:'link',potential_personal_information_request:'personal'}[item.predictedAction]]?.label||item.predictedAction)}</p>`:''}${warning?`<p class="history-detail">${icon('check')}Your action: ${h(ACTION_LABELS[warning.customerAction]||warning.customerAction)}</p>`:''}${(()=>{const c=item.indicators&&findConnections(item.indicators).campaigns[0];return c?`<span class="network-chip">${icon('shield')}${h(c.strengthLabel)}: ${h(c.name)} · demo intelligence</span>`:'';})()}</div><div class="history-actions">${badge(item.risk)}<a class="text-link" href="#/recovery/${h(item.id)}">Next steps ${icon('arrow')}</a><button class="text-button destructive" data-action="delete-incident" data-id="${h(item.id)}" aria-label="Delete check from ${h(date(item.updatedAt,true))}">${icon('trash')}Delete</button></div></article>`;}).join('')}</div>`:`<div class="empty-state">${icon('clock')}<h2>A fresh start.</h2><p>Your call simulations and message checks will appear here. Raw conversations are never saved.</p><a class="button primary" href="#/calls">Try a practice call ${icon('arrow')}</a></div>`}</section>`;
}
export function learn(state) {
  return intro('Small habits. Stronger protection.','A practical guide to the situations that deserve a second look.')+
    `<div class="lesson-list">${Object.entries(CATEGORIES).map(([id,category])=>`<details class="lesson"><summary><span class="lesson-icon">${icon(id==='family'||id==='romance'?'heart':id==='credentials'?'lock':'shield')}</span><span>${h(category.label)}</span>${icon('plus')}</summary><div class="lesson-body"><p>${h(category.advice)}</p><h3>A phrase you can use</h3><blockquote>“I’m going to pause and check this independently. I’ll call back using a number I already know.”</blockquote><div class="button-row">${contactAction(state.contact)}<a class="text-link" href="#/calls">Practice this habit ${icon('arrow')}</a></div></div></details>`).join('')}
    <details class="lesson"><summary><span class="lesson-icon">${icon('headphones')}</span><span>AI voices and voice cloning</span>${icon('plus')}</summary><div class="lesson-body"><p>A few seconds of audio can be enough to imitate someone’s voice. A familiar voice is not proof of who is calling, and neither is a caller ID name.</p><h3>Set up a family passphrase</h3><p>Agree on a private word or question with close family, in person. If a caller says they’re family and asks for help, ask for it. Never share the passphrase in a text, email, or app.</p></div></details></div><div class="guide-source">More guidance from the <a href="https://consumer.ftc.gov/scams" target="_blank" rel="noopener noreferrer">Federal Trade Commission ${icon('external')}</a>.</div>`;
}
export const recoverySteps={
  stop:['Stop all contact','Don’t reply, call back, or send anything more, even if they threaten or plead.'],
  'contact-bank':['Call your bank or payment provider now','Use the number on your card or the official app. Ask if the payment can be stopped or reversed. Acting quickly helps, but recovery isn’t guaranteed. For gift cards, call the card company on the number on the card; for wire or crypto transfers, contact the service you used.'],
  evidence:['Keep the evidence','Don’t delete anything. Screenshot messages, note the phone number, time, and amount, and keep receipts.'],
  report:['Report what happened','Report to the FTC at ReportFraud.ftc.gov and forward scam texts to 7726. If money was lost, also report to local police and the FBI at ic3.gov.'],
  monitor:['Watch your accounts','Check bank and card statements for charges you don’t recognize over the next few weeks.'],
  trusted:['Talk to someone you trust','You don’t have to handle this alone. Scams happen to careful, intelligent people every day.'],
  'account-provider':['Contact the company the code belongs to','A verification code lets someone sign in as you. Use the company’s official app or number to secure the account.'],
  passwords:['Change your passwords','Change the password for the affected account and any account that uses the same password. Turn on two-step verification.'],
  carrier:['Ask your mobile carrier about account protection','Ask about a port-out or SIM-change lock so no one can move your number to another phone.'],
  'link-check':['If you typed anything on the page, treat it as shared','Passwords: change them now. Card details: call your card issuer. Close the page and don’t revisit it.'],
  devices:['Remove remote access','Uninstall the app they asked for, disconnect from the internet, and have a trusted technician check the device.'],
  credit:['Protect your identity','Consider a free credit freeze with Equifax, Experian, and TransUnion. IdentityTheft.gov has a personal recovery plan.'],
};
export const RECOVERY_TOPICS=[
  ['payment','I sent money',['stop','contact-bank','evidence','report','monitor','trusted']],
  ['credentials','I shared a verification code',['stop','account-provider','passwords','carrier','evidence','report','trusted']],
  ['link','I clicked a suspicious link',['stop','link-check','passwords','monitor','report','trusted']],
  ['personal','I shared personal information',['stop','credit','passwords','monitor','evidence','report','trusted']],
  ['app','I installed an application',['stop','devices','passwords','contact-bank','monitor','trusted']],
  ['unsure','I am not sure what happened',['stop','evidence','monitor','trusted','report']],
];
export function recovery(state,ui,incidentId) {
  const topic=RECOVERY_TOPICS.find(([id])=>id===ui.recoveryTopic)||null;
  const saved=state.incidents.find((i)=>i.id===incidentId)?.recovery || ui.recoverySteps || [];
  return intro('Recovery Assistant','Scams can happen to anyone. Let’s take the next step together, without judgment.')+
    `<section class="recovery-topics" aria-labelledby="topic-title"><h2 id="topic-title">What happened?</h2><div class="topic-grid">${RECOVERY_TOPICS.map(([id,label])=>`<button class="topic-button ${topic?.[0]===id?'selected':''}" data-action="recovery-topic" data-topic="${id}" aria-pressed="${topic?.[0]===id}">${h(label)}</button>`).join('')}</div></section>
    ${topic?`<div class="recovery-grid"><section class="recovery-checklist" aria-labelledby="steps-title"><h2 id="steps-title">Your next steps</h2>${topic[0]==='unsure'?`<div class="triage"><p>That’s okay. Answer these to find the right steps:</p><ul><li><button class="text-link" data-action="recovery-topic" data-topic="payment">Did any money or gift cards leave your hands?</button></li><li><button class="text-link" data-action="recovery-topic" data-topic="credentials">Did you read out or type a code you received?</button></li><li><button class="text-link" data-action="recovery-topic" data-topic="link">Did you tap a link or enter details on a website?</button></li><li><button class="text-link" data-action="recovery-topic" data-topic="app">Did you install anything or let someone control your device?</button></li></ul></div>`:''}
      <ol class="checklist">${topic[2].map((id)=>`<li><label class="checklist-item"><input type="checkbox" name="recovery-step" value="${id}" ${saved.includes(id)?'checked':''}><span><strong>${h(recoverySteps[id][0])}</strong><span>${h(recoverySteps[id][1])}</span></span></label></li>`).join('')}</ol>
      <p class="quiet-note">${incidentId?'Your checklist progress is saved with this check.':'Open a check from Protection history to save progress with it.'}</p></section>
    <aside class="recovery-aside"><div class="support-note">${icon('heart')}<h2>A trusted voice helps.</h2><p>Telling someone you trust is a protective step, not an embarrassing one. It’s your choice who to involve.</p>${state.contacts.map((c)=>`<a class="button secondary" href="tel:${h(c.phone.replace(/[^+\d]/g,''))}">${icon('phone')}Call ${h(c.displayName)}</a>`).join('')||contactAction(null)}</div><div class="simple-section"><h2>Official resources</h2><a class="resource-link" href="https://consumer.ftc.gov/articles/what-do-if-you-were-scammed" target="_blank" rel="noopener noreferrer">FTC: what to do if you were scammed ${icon('external')}</a><a class="resource-link" href="https://reportfraud.ftc.gov/" target="_blank" rel="noopener noreferrer">Report fraud to the FTC ${icon('external')}</a><a class="resource-link" href="https://www.ic3.gov/" target="_blank" rel="noopener noreferrer">FBI Internet Crime Complaint Center ${icon('external')}</a><a class="resource-link" href="https://www.identitytheft.gov/" target="_blank" rel="noopener noreferrer">IdentityTheft.gov ${icon('external')}</a><p class="quiet-note">T-Secure cannot reverse payments or guarantee that money will be recovered. These steps give you the best chance.</p></div></aside></div>`:`<p class="recovery-prompt">${icon('arrow')}Choose what happened above to see clear, practical steps.</p>`}`;
}
export function about() {
  return intro('Clear about what we do.','T-Secure is a working hackathon prototype for recognizing manipulation and building safer habits.')+
    `<div class="about-content"><section><h2>Calls are simulated.</h2><p>There is no carrier integration and no permission to monitor real calls. The app plays scripted, fictional conversations and analyzes the transcript progressively as it appears. A production version would transcribe consented audio with a speech-to-text model; that is not part of this prototype. Optional voices come from your browser’s text-to-speech.</p></section>
    <section><h2>Analysis sources are always labeled.</h2><p>Independent rules run first. On a configured server, the text also goes to one AI provider: NVIDIA Nemotron via OpenRouter, or Google Gemini. The model must quote exact evidence, its JSON is validated before use, and it can raise a rating by one level at most. If the provider is unavailable, you see that clearly. Demo mode uses rules in your browser and says so.</p></section>
    <section><h2>No vulnerability scores. No profiling.</h2><p>Your Protection Profile only customizes how warnings look and how you verify callers. T-Secure never scores you, and never diagnoses a caller’s personality or anyone’s emotional state. It describes observable tactics in the words used.</p></section>
    <section><h2>Synthetic voices are a future supporting signal.</h2><p>A cloned voice doesn’t prove fraud, and a human voice doesn’t prove legitimacy. Not all AI voices can be detected. T-Secure prioritizes the conversation, identity claims, payment requests, and verification you control: a saved number, a family passphrase, a callback, or another channel.</p></section>
    <section><h2>Scam Network Intelligence uses demo data.</h2><p>It compares derived indicators (sender, domains, impersonated identity, requests, tactics, and hashed wording) with a synthetic campaign dataset and your own earlier warnings. There is no global scam database here. The design is modular so a privacy-preserving, aggregated feed could be added later.</p></section>
    <section><h2>T-Mobile and T-Life are future opportunities.</h2><p>This prototype uses a T-Mobile-inspired design. T-Mobile has not approved or integrated it. The T-Life view is a concept of how the Protection Profile could appear there.</p></section>
    <section><h2>No invented numbers.</h2><p>We show no protection statistics or accuracy claims. The developer page shows only results measured on synthetic scenarios, with their limits explained.</p></section>
    <a class="button primary" href="#/home">Back to your dashboard ${icon('arrow')}</a></div>`;
}
export function authView(state,ui,configured) {
  const verify=state.user && !state.user.demo && !state.user.emailVerified;
  const mode=ui.authMode;
  const signup=mode==='signup',reset=mode==='reset';
  return `<main class="auth-page" id="main" tabindex="-1"><a class="brand" href="#/welcome"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></a><div class="auth-layout"><section class="auth-intro"><h1>Protecting the people behind every conversation.</h1><p>A space to pause, understand the warning signs, and find your next step.</p><div class="auth-trust">${icon('lock')}Private by default. Always your choice.</div><button class="text-link" data-action="enter-demo">Explore the demo instead ${icon('arrow')}</button></section><section class="auth-panel">
    ${verify?`<span class="task-symbol pink">${icon('message')}</span><h2>Check your inbox.</h2><p>Open the verification link sent to <strong>${h(state.user.email)}</strong>, then come back here.</p><p class="verify-status" role="status">${icon('info')}Email not verified yet. Protected features unlock after verification.</p><button class="button primary full" data-action="check-verification">I’ve verified my email</button><button class="button secondary full" data-action="resend-verification">Resend verification email</button><button class="text-button" data-action="logout">Use a different account</button>`:
    `<h2>${signup?'Create your account':reset?'Reset your password':'Welcome back'}</h2><p>${signup?'A few details, then we’ll set up your protection profile.':reset?'We’ll send a reset link to your email.':'Sign in to your personal safety space.'}</p>
    ${!configured?'<div class="notice">Accounts aren’t connected in this build yet. You can explore the full demo now.</div>':''}
    <form id="auth-form" novalidate>${signup?'<label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="given-name" maxlength="80" required>':''}<label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required>${!reset?`<label for="auth-password">Password</label><input id="auth-password" name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required aria-describedby="password-help">${signup?'<p class="field-help" id="password-help">At least 8 characters.</p><label for="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirm" type="password" minlength="8" autocomplete="new-password" required>':'<span id="password-help" hidden></span>'}`:''}
    <p class="form-error" id="auth-error" role="alert" aria-live="assertive"></p>
    <button class="button primary full" type="submit" ${!configured?'disabled':''}>${signup?'Create account':reset?'Send reset link':'Sign in'}${icon('arrow')}</button></form>
    ${!reset?`<div class="auth-divider"><span>or</span></div><button class="button secondary full" data-action="google" ${!configured?'disabled':''}><span class="google-letter">G</span>Continue with Google</button>`:''}
    <div class="auth-links">${reset?'<a class="text-button" href="#/login">Back to sign in</a>':signup?'Already have an account? <a class="text-button" href="#/login">Sign in</a>':'<a class="text-button" href="#/reset">Forgot password?</a><span>New here? <a class="text-button" href="#/signup">Create an account</a></span>'}</div>`}
  </section></div></main>`;
}
