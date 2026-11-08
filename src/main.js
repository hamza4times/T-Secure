import '@fontsource-variable/manrope';
import './styles.css';
import './components.css';
import { Client, firebaseConfigured, friendlyAuthError, preferencesOf, needsOnboarding } from './client.js';
import { CallSession } from './call-session.js';
import { CallAudio } from './call-audio.js';
import { CallVoice } from './call-voice.js';
import { analyzeText } from '../shared/detection.js';
import { analyzeConversation } from '../shared/prediction.js';
import { scenarios, messageSamples } from '../shared/fixtures.js';
import { EVALUATION_SCENARIOS, runRules, scoreResult, summarize } from '../shared/evaluation.js';
import { h, icon, riskLabels } from './ui.js';
import * as views from './views.js';
import { landing } from './pages/landing.js';
import { onboarding, readPreferences } from './pages/onboarding.js';
import { developer } from './pages/developer.js';

const client=new Client();
const ui={
  scenario:'family',call:{status:'idle',turns:[],analysis:{risk:'low',reasons:[]}},callElapsed:0,callVoice:false,warningPanel:null,warningId:null,
  messageText:'',messageSender:'',messageChecked:null,messageResult:null,messageBusy:false,
  authMode:'login',recoveryTopic:null,recoverySteps:[],menuOpen:false,audioUnavailable:false,
  onboarding:null,dev:{status:null,runs:{},busy:null,error:null,loading:false},
};
const AUTH_ROUTES=['login','signup','reset'];
const TITLES={home:'Dashboard',calls:'Live call protection',messages:'SMS and link scanner',profile:'Protection profile',settings:'Settings',history:'Protection history',learn:'Safety guide',recovery:'Recovery Assistant','t-life':'T-Life preview',about:'About this prototype',developer:'Model evaluation',onboarding:'Set up your protection',login:'Sign in',signup:'Create account',reset:'Reset password'};
const app=document.querySelector('#app');
const warningDialog=document.querySelector('#call-warning-dialog');
let lastCallAlertId=null;
try{ui.callVoice=localStorage.getItem('tsecure:call-voice')==='on';}catch{/* Voices stay off without storage. */}
const callAudio=new CallAudio({onUnavailable:()=>{
  ui.audioUnavailable=true;
  const status=document.querySelector('#call-audio-status');
  if(status)status.textContent='Audio is unavailable. Visual warnings remain active.';
}});
const callVoice=new CallVoice();
callVoice.enabled=ui.callVoice;
const route=()=>{const parts=location.hash.replace(/^#\/?/,'').split('/');return {name:parts[0]||'welcome',id:parts[1]||null};};
function notify(message,error=false) {
  clearTimeout(notify.timer);
  const target=document.querySelector('#notifications');
  target.innerHTML=`<div class="toast ${error?'toast-error':''}" ${error?'role="alert"':''}>${icon(error?'alert':'check')}<span>${h(message)}</span><button aria-label="Dismiss notification" data-action="dismiss">×</button></div>`;
  notify.timer=setTimeout(()=>{target.innerHTML='';},8000);
}
// Accessibility preferences apply to the whole document, including the landing and sign-in pages.
function applyPreferences(preferences) {
  const root=document.documentElement;
  root.dataset.textSize=preferences.textSize;
  root.dataset.contrast=preferences.highContrast?'high':'standard';
  root.dataset.motion=preferences.reduceMotion?'reduced':'standard';
  callAudio.mode=preferences.callAlertAudio;
}
function startOnboarding(state) {
  ui.onboarding={step:0,draft:{displayName:state.profile?.displayName||(state.user?.demo?'':state.user?.displayName)||'',preferences:preferencesOf(state)}};
}
function render() {
  const state=client.state,current=route();
  const focused=document.activeElement;
  const callFocus=current.name==='calls'&&focused?.closest('#call-workspace')?focused.dataset.action:null;
  const transcriptReview=focused?.classList.contains('transcript')?{scrollTop:focused.scrollTop}:null;
  applyPreferences(ui.onboarding&&current.name==='onboarding'?ui.onboarding.draft.preferences:preferencesOf(state));
  if(state.loading){app.innerHTML='<p class="boot" role="status">Getting your safety space ready…</p>';return;}
  const signedIn=state.user&&(state.demo||state.user.emailVerified);
  if(AUTH_ROUTES.includes(current.name)&&!(signedIn&&!state.demo)){ui.authMode=current.name;app.innerHTML=views.authView(state,ui,firebaseConfigured);document.title=TITLES[current.name]+' · T-Secure';return;}
  if(state.user&&!state.demo&&!state.user.emailVerified){app.innerHTML=views.authView(state,ui,firebaseConfigured);document.title='Verify your email · T-Secure';return;}
  if(!signedIn){app.innerHTML=landing(firebaseConfigured);document.title='T-Secure · Protecting the people behind every conversation';return;}
  if(needsOnboarding(state)||current.name==='onboarding'){
    if(!ui.onboarding)startOnboarding(state);
    if(current.name!=='onboarding'){location.replace('#/onboarding');return;}
    app.innerHTML=onboarding(state,ui);document.title=TITLES.onboarding+' · T-Secure';return;
  }
  ui.onboarding=null;
  const pages={
    home:()=>views.home(state),calls:()=>views.calls(state,ui),messages:()=>views.messages(state,ui),
    profile:()=>views.profile(state),settings:()=>views.settings(state),history:()=>views.history(state),
    learn:()=>views.learn(state),recovery:()=>views.recovery(state,ui,current.id),
    't-life':()=>views.profile(state,true),about:()=>views.about(),developer:()=>developer(state,ui),
  };
  const name=pages[current.name]?current.name:'home';
  app.innerHTML=views.shell(state,name,pages[name](),ui.menuOpen);
  document.title=(TITLES[name]||'T-Secure')+' · T-Secure';
  if(name==='developer'&&!state.demo&&!ui.dev.status&&!ui.dev.loading)loadBenchmarkStatus();
  if(!warningDialog.open){
    if(callFocus)restoreCallFocus(callFocus);
    if(transcriptReview)restoreTranscriptFocus(transcriptReview.scrollTop);
  }
}
function restoreTranscriptFocus(scrollTop) {
  const transcript=document.querySelector('.transcript');
  if(transcript){transcript.focus({preventScroll:true});transcript.scrollTop=scrollTop;}
}
function restoreCallFocus(action) {
  const workspace=document.querySelector('#call-workspace');
  const controls=[...workspace?.querySelectorAll('[data-action]')||[]];
  const same=controls.find(control=>control.dataset.action===action);
  const counterpart=controls.find(control=>control.dataset.action===(action==='pause'?'resume':action==='resume'?'pause':''));
  (same||counterpart)?.focus({preventScroll:true});
}
async function logWarning(level,prediction,channel,incidentId) {
  try{return await client.logWarning({warningType:views.warningTypeOf(prediction),warningLevel:level,incidentId:incidentId||undefined,channel});}
  catch{return null;/* A failed log never blocks a warning. */}
}
function recordAction(action) {client.updateWarning(ui.warningId,action).catch(()=>{});}
let spokenTurns=0;
const session=new CallSession({
  analyze:(input,signal)=>client.analyze(input,signal),
  onChange:(snapshot)=>{
    const oldRisk=ui.call.analysis?.risk;
    ui.call=snapshot;ui.callElapsed=session.elapsedMs();
    if(snapshot.turns.length>spokenTurns&&snapshot.status==='playing')callVoice.speak(snapshot.turns.at(-1));
    spokenTurns=snapshot.turns.length;
    const workspace=document.querySelector('#call-workspace');
    if(workspace){
      const action=workspace.contains(document.activeElement)?document.activeElement?.dataset.action:null;
      const reviewing=document.activeElement?.classList.contains('transcript');
      const previousScroll=reviewing?document.activeElement.scrollTop:0;
      workspace.innerHTML=views.callWorkspace(client.state,ui);
      const selector=document.querySelector('#scenario');if(selector)selector.disabled=['playing','paused'].includes(snapshot.status);
      const transcript=workspace.querySelector('.transcript');
      if(transcript)transcript.scrollTop=reviewing?previousScroll:transcript.scrollHeight;
      if(oldRisk!==snapshot.analysis.risk&&snapshot.analysis.risk==='unknown')document.querySelector('#call-announcement').textContent=riskLabels.unknown+'. Keep verifying independently.';
      if(action)restoreCallFocus(action);
      if(reviewing)restoreTranscriptFocus(previousScroll);
    }
    const active=['playing','paused'].includes(snapshot.status);
    if(snapshot.status!=='playing')callVoice.stop();
    if(!active){warningDialog.close();callAudio.stop();}
    if(active&&route().name==='calls'&&snapshot.alert&&snapshot.alert.id!==lastCallAlertId){
      lastCallAlertId=snapshot.alert.id;
      const quiet=snapshot.alert.risk==='caution'&&preferencesOf(client.state).warningStyle==='high-only';
      if(quiet)return;
      const announcement=document.querySelector('#call-announcement');
      if(announcement)announcement.textContent=snapshot.alert.risk==='high'?'High risk. The simulated call is paused. Verify the caller independently.':'Elevated risk. Pressure or urgency deserves a second look.';
      ui.warningId=null;
      logWarning(snapshot.alert.risk,snapshot.insight?.prediction,'call',snapshot.sessionId).then((id)=>{ui.warningId=id;});
      callVoice.stop();
      if(snapshot.alert.risk==='high'){ui.warningPanel=null;openCallWarning();}
      callAudio.play(snapshot.alert.risk);
    }
  },
});
setInterval(()=>{
  if(ui.call.status!=='playing')return;
  ui.callElapsed=session.elapsedMs();
  const timer=document.querySelector('#call-timer');if(timer)timer.textContent=views.formatDuration(ui.callElapsed);
},500);
function openCallWarning() {
  warningDialog.innerHTML=views.callWarningDialog(ui.call,client.state,ui.warningPanel);
  if(!warningDialog.open)warningDialog.showModal();
  if(ui.warningPanel)warningDialog.querySelector('#warning-panel')?.focus();
  else warningDialog.querySelector('[data-panel="verify"]')?.focus();
}
function closeCallWarning(resume=false) {
  warningDialog.close();callAudio.stop();
  if(resume)session.resume();
  document.querySelector(ui.call.status==='paused'?'[data-action="resume"]':ui.call.status==='playing'?'[data-action="pause"]':'[data-action="start-call"]')?.focus();
}
warningDialog.addEventListener('cancel',event=>{event.preventDefault();recordAction('dismissed');closeCallWarning();});
client.subscribe((state)=>{
  if(state.user?.emailVerified&&!state.demo&&AUTH_ROUTES.includes(route().name))location.hash='/home';
  render();
});
window.addEventListener('hashchange',()=>{
  ui.menuOpen=false;
  if(route().name!=='calls'&&['playing','paused'].includes(ui.call.status))session.end();
  if(route().name!=='recovery')ui.recoveryTopic=null;
  render();window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('main, #main')?.focus({preventScroll:true});
});
async function loadBenchmarkStatus() {
  ui.dev.loading=true;ui.dev.error=null;
  try{ui.dev.status=await client.benchmarkStatus();}
  catch(error){ui.dev.error=error.message;}
  finally{ui.dev.loading=false;if(route().name==='developer')render();}
}
// The rule baseline runs locally in demo mode; its numbers are measured, not estimated.
function localBenchmark() {
  const runs=EVALUATION_SCENARIOS.map((s)=>{
    const started=performance.now();
    const result=runRules(s.text,s.type);
    return {scenarioId:s.id,result,score:scoreResult(s.expected,result),error:null,latencyMs:performance.now()-started,usage:null};
  });
  return {provider:{id:'rules',label:'Rule-based baseline',model:'deterministic rules'},ranAt:new Date().toISOString(),runs,summary:summarize(runs)};
}
function startCall() {
  spokenTurns=0;ui.warningPanel=null;ui.warningId=null;
  session.start(scenarios.find((s)=>s.id===ui.scenario));
}
document.addEventListener('click',async(event)=>{
  const skip=event.target.closest('.skip-link');
  if(skip){event.preventDefault();document.querySelector('main, #main')?.focus();return;}
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const action=button.dataset.action;
  // Phone and navigation links keep their default behavior; their actions only record a choice.
  const passthrough=['call-contact','open-recovery'].includes(action);
  if(button.tagName==='A'&&!passthrough)event.preventDefault();
  try {
    switch(action){
      case 'dismiss':document.querySelector('#notifications').innerHTML='';break;
      case 'toggle-menu':ui.menuOpen=!ui.menuOpen;render();document.querySelector('[data-action="toggle-menu"]')?.focus({preventScroll:true});break;
      case 'enter-demo':client.enterDemo();ui.onboarding=null;location.hash=needsOnboarding(client.state)?'/onboarding':'/home';break;
      case 'start-call':await callAudio.prepare();startCall();if(!warningDialog.open)restoreCallFocus('pause');break;
      case 'restart-call':startCall();if(!warningDialog.open)restoreCallFocus('pause');break;
      case 'pause':session.pause();break;
      case 'resume':session.resume();break;
      case 'end-call':if(warningDialog.open)recordAction('ended-call');session.end();closeCallWarning();break;
      case 'dismiss-warning':recordAction('dismissed');closeCallWarning();break;
      case 'continue-call':recordAction('continued');closeCallWarning(true);break;
      case 'warning-panel':{
        const panel=button.dataset.panel;
        ui.warningPanel=ui.warningPanel===panel?null:panel;
        if(ui.warningPanel)recordAction({verify:'viewed-verification',evidence:'viewed-evidence',help:'asked-for-help'}[panel]);
        openCallWarning();break;
      }
      case 'call-contact':recordAction('called-trusted-contact');break;
      case 'open-recovery':warningDialog.close();session.end();break;
      case 'review-call-warning':session.pause();openCallWarning();break;
      case 'pause-to-verify':session.pause();document.querySelector('.call-guidance')?.focus();break;
      case 'message-sample':{const sample=messageSamples[Number(button.dataset.index)];ui.messageText=sample.text;ui.messageSender=sample.sender||'';ui.messageResult=null;ui.messageChecked=null;}render();document.querySelector('#message-text')?.focus();break;
      case 'show-evidence':{
        if(ui.messageWarningId)client.updateWarning(ui.messageWarningId,'viewed-evidence').catch(()=>{});
        const target=document.querySelector('#message-breakdown');target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});break;
      }
      case 'delete-contact':await client.deleteContact(button.dataset.id);notify('Trusted contact removed.');break;
      case 'delete-incident':await client.deleteIncident(button.dataset.id);notify('Check deleted.');break;
      case 'delete-history':
        if(!window.confirm('Delete all saved checks and warning records? This cannot be undone.'))break;
        await client.deleteAllHistory();notify('Your protection history was deleted.');break;
      case 'delete-account':
        if(!window.confirm(client.state.demo?'Reset the demo and remove everything saved in this browser?':'Permanently delete your T-Secure account and all of its data?'))break;
        session.end();await client.deleteAccount();ui.onboarding=null;location.hash='/welcome';notify(client.state.demo?'Demo reset.':'Your account and data were deleted.');break;
      case 'recovery-topic':ui.recoveryTopic=button.dataset.topic;render();document.querySelector('#steps-title')?.focus?.();break;
      case 'logout':session.end();ui.messageText='';ui.messageSender='';ui.messageChecked=null;ui.messageResult=null;ui.onboarding=null;ui.dev={status:null,runs:{},busy:null,error:null,loading:false};await client.logout();location.hash='/welcome';break;
      case 'google':button.disabled=true;await client.google();break;
      case 'resend-verification':button.disabled=true;await client.resend();notify('Verification email sent. Please check your inbox.');break;
      case 'check-verification':button.disabled=true;await client.refreshVerification();break;
      case 'retry-account':window.location.reload();break;
      case 'onboarding-back':ui.onboarding.step=Math.max(0,ui.onboarding.step-1);render();break;
      case 'skip-onboarding':await client.saveProfile({displayName:ui.onboarding?.draft.displayName||client.state.user?.displayName||'',onboardingCompleted:true,preferences:ui.onboarding?.draft.preferences||{}});ui.onboarding=null;location.hash='/home';break;
      case 'run-benchmark':{
        const provider=button.dataset.provider;
        ui.dev.busy=provider;ui.dev.error=null;render();
        try{ui.dev.runs[provider]=client.state.demo?localBenchmark():await client.runBenchmark(provider);}
        catch(error){ui.dev.error=error.message;}
        finally{ui.dev.busy=null;render();}
        break;
      }
    }
  }catch(error){notify(friendlyAuthError(error),true);}
  finally{if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',(event)=>{
  if(event.target.id==='message-text')ui.messageText=event.target.value;
  if(event.target.id==='message-sender')ui.messageSender=event.target.value;
});
document.addEventListener('change',async(event)=>{
  const element=event.target;
  try{
    if(element.id==='scenario'){
      ui.scenario=element.value;session.end(false);ui.callElapsed=0;
      ui.call={status:'idle',turns:[],analysis:{risk:'low',reasons:[]}};render();
    }
    if(element.id==='call-alert-audio'){
      ui.audioUnavailable=false;
      const status=document.querySelector('#call-audio-status');if(status)status.textContent='';
      await callAudio.setMode(element.value);
      await client.saveProfile({preferences:{callAlertAudio:element.value}});
    }
    if(element.id==='call-voice'){
      ui.callVoice=element.checked;callVoice.enabled=element.checked;
      if(!element.checked)callVoice.stop();
      try{localStorage.setItem('tsecure:call-voice',element.checked?'on':'off');}catch{/* Optional preference. */}
    }
    // Display preferences preview immediately while editing.
    const form=element.closest('#onboarding-form, #preferences-form-access');
    if(form&&['textSize','highContrast','reduceMotion'].includes(element.name)){
      const preview=readPreferences(form,ui.onboarding?.draft.preferences||preferencesOf(client.state));
      if(ui.onboarding&&route().name==='onboarding')ui.onboarding.draft.preferences=preview;
      applyPreferences(preview);
    }
    if(element.name==='recovery-step'){
      const steps=[...document.querySelectorAll('[name="recovery-step"]:checked')].map((input)=>input.value);
      const id=route().id;
      const previous=id?client.state.incidents.find((item)=>item.id===id)?.recovery||[]:ui.recoverySteps;
      const visible=[...document.querySelectorAll('[name="recovery-step"]')].map((input)=>input.value);
      const merged=[...previous.filter((step)=>!visible.includes(step)),...steps];
      if(id)await client.saveRecovery(id,merged);else ui.recoverySteps=merged;
    }
  }catch(error){notify(friendlyAuthError(error),true);render();}
});
function authError(message) {
  const target=document.querySelector('#auth-error');
  if(target)target.textContent=message;else notify(message,true);
}
function validateAuth(data) {
  if(ui.authMode==='signup'&&!data.name?.trim())return 'Enter your name.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||''))return 'Enter a valid email address.';
  if(ui.authMode!=='reset'&&(data.password||'').length<8)return 'Passwords have at least 8 characters.';
  if(ui.authMode==='signup'&&data.password!==data.confirm)return 'The two passwords do not match. Please type them again.';
  return null;
}
document.addEventListener('submit',async(event)=>{
  const form=event.target;
  if(!['message-form','auth-form','contact-form','onboarding-form','preferences-form','preferences-form-access'].includes(form.id))return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  try{
    if(form.id==='message-form'){
      ui.messageText=data.text;ui.messageSender=(data.sender||'').trim();ui.messageBusy=true;ui.messageResult=null;ui.messageWarningId=null;
      const text=data.text;
      ui.messageChecked={text,sender:ui.messageSender};render();
      // Immediate checks never wait for the AI provider.
      ui.messageResult=analyzeText(text);render();
      try{
        const result=await client.analyze({channel:/^https?:\/\/\S+$/.test(text.trim())?'link':'message',text,sender:ui.messageSender,sequence:1});
        if(ui.messageText===text){
          ui.messageResult=result;
          const insight=analyzeConversation([{speaker:'contact',text}]);
          const level=views.effectiveRisk({insight,analysis:result});
          if(['caution','high'].includes(level))logWarning(level,insight.prediction,'message',result.sessionId).then((id)=>{ui.messageWarningId=id;});
        }
      }catch(error){
        ui.messageResult.incomplete=true;
        if(ui.messageResult.risk==='low')ui.messageResult.risk='unknown';
        notify(friendlyAuthError(error),true);
      }finally{ui.messageBusy=false;render();}
    }
    if(form.id==='contact-form'){
      await client.addContact(data);
      notify('Trusted contact saved.');
      if(ui.onboarding)render();
    }
    if(form.id==='onboarding-form'){
      const draft=ui.onboarding.draft;
      const step=Number(form.dataset.step);
      if([1,2].includes(step))draft.preferences=readPreferences(form,draft.preferences);
      if(step===2&&data.displayName!=null)draft.displayName=data.displayName.trim();
      if(step===4){
        if(!form.elements.consent.checked){notify('Please confirm you understand how your information is used.',true);return;}
        await client.saveProfile({displayName:draft.displayName,preferences:draft.preferences,onboardingCompleted:true,privacyAcknowledged:true});
      }
      ui.onboarding.step=step+1;render();
      document.querySelector('.onboarding-card h1')?.setAttribute('tabindex','-1');document.querySelector('.onboarding-card h1')?.focus();
    }
    if(form.id==='preferences-form'||form.id==='preferences-form-access'){
      const preferences=readPreferences(form,preferencesOf(client.state));
      await client.saveProfile({preferences,...(data.displayName!=null?{displayName:data.displayName}:{})});
      notify('Preferences saved.');
    }
    if(form.id==='auth-form'){
      const problem=validateAuth(data);
      if(problem){authError(problem);return;}
      authError('');
      if(ui.authMode==='signup')await client.signup(data);
      else if(ui.authMode==='reset'){await client.reset(data.email);notify('If an account exists for that email, a reset link is on its way.');}
      else await client.login(data.email,data.password);
    }
  }catch(error){form.id==='auth-form'?authError(friendlyAuthError(error)):notify(friendlyAuthError(error),true);}
  finally{if(submit?.isConnected)submit.disabled=false;}
});
render();
client.init().catch((error)=>{client.state.loading=false;render();notify(friendlyAuthError(error),true);});
