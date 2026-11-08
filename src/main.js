import '@fontsource-variable/manrope';
import './styles.css';
import { Client, firebaseConfigured, friendlyAuthError } from './client.js';
import { CallSession } from './call-session.js';
import { CallAudio } from './call-audio.js';
import { LiveAudio } from './live-audio.js';
import { registerPwa } from './pwa.js';
import { analyzeText } from '../shared/detection.js';
import {emotionWarning} from '../shared/emotion.js';
import { messageSamples } from '../shared/fixtures.js';
import { h, icon, riskLabels } from './ui.js';
import * as views from './views.js';
import {recordedTests,mountRecordedTests} from './recorded-tests.js';

const client=new Client();
const ui={
  scenario:'family',callMode:'practice',callerTrust:'unknown',callConnecting:false,callAudioStatus:'',callPartial:'',call:{status:'idle',turns:[],analysis:{risk:'unknown',reasons:[]}},
  messageText:'',messageResult:null,messageBusy:false,profileBusy:false,profileOperation:0,
  authMode:'login',recoveryTopic:'payment',recoverySteps:[],menuOpen:false,callAudio:'visual',audioUnavailable:false,
};
const app=document.querySelector('#app');
const warningDialog=document.querySelector('#call-warning-dialog');
let lastCallAlertId=null;
let lastEmotionAlertId=null;
let liveAudio,callerController,replyTimer,callerBusy=false,callOperation=0;
let pendingActions=0;
try{
  const saved=localStorage.getItem('tsecure:call-alert-audio');
  if(['visual','tone','speech'].includes(saved))ui.callAudio=saved;
}catch{/* Visual alerts work without browser storage. */}
const callAudio=new CallAudio({onUnavailable:()=>{
  ui.audioUnavailable=true;
  const status=document.querySelector('#call-audio-status');
  if(status)status.textContent='Audio is unavailable. Visual alerts remain active.';
}});
callAudio.mode=ui.callAudio;
const route=()=>{const parts=location.hash.replace(/^#\/?/,'').split('/');return {name:parts[0]||'home',id:parts[1]||null};};
function notify(message,error=false) {
  clearTimeout(notify.timer);
  const target=document.querySelector('#notifications');
  target.innerHTML=`<div class="toast ${error?'toast-error':''}" ${error?'role="alert"':''}>${icon(error?'alert':'check')}<span>${h(message)}</span><button aria-label="Dismiss notification" data-action="dismiss">×</button></div>`;
  notify.timer=setTimeout(()=>{target.innerHTML='';},8000);
}
function render() {
  const state=client.state,current=route();
  const previousRecorded=document.querySelector('#recorded-test-detail');
  const focused=document.activeElement;
  const callFocus=current.name==='calls'&&focused?.closest('#call-workspace')?focused.dataset.action:null;
  const audioFocused=focused?.id==='call-alert-audio';
  const transcriptReview=focused?.classList.contains('transcript')?{scrollTop:focused.scrollTop}:null;
  if(state.loading){app.innerHTML='<p class="boot" role="status">Getting your safety space ready…</p>';return;}
  if(!state.user || (!state.demo&&!state.user.emailVerified) || current.name==='account'){
    previousRecorded?.querySelectorAll('audio').forEach(audio=>audio.pause());
    app.innerHTML=views.authView(state,ui,firebaseConfigured);return;
  }
  const pages={
    home:()=>views.home(state),calls:()=>views.calls(state,ui),messages:()=>views.messages(state,ui),
    profile:()=>views.profile(state,ui),settings:()=>views.settings(state,ui),history:()=>views.history(state),
    learn:()=>views.learn(state),recovery:()=>views.recovery(state,ui,current.id),
    't-life':()=>views.profile(state,ui,true),about:()=>views.about(),
    'recorded-tests':()=>recordedTests(current.id),
  };
  app.innerHTML=views.shell(state,current.name,(pages[current.name]||pages.home)(),ui.menuOpen);
  mountRecordedTests(previousRecorded);
  document.title=(current.name==='home'?'T-Secure':({'t-life':'T-Life preview','recorded-tests':'Recorded tests',calls:'Call protection',messages:'Check a message',profile:'My profile',settings:'Settings',history:'Recent activity',learn:'Safety guide',recovery:'Recovery guidance',about:'About this demo'}[current.name]||'T-Secure'))+' · A safer next step';
  if(!warningDialog.open){
    if(callFocus)restoreCallFocus(callFocus);
    if(audioFocused)document.querySelector('#call-alert-audio')?.focus({preventScroll:true});
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
const session=new CallSession({
  analyze:(input,signal)=>client.analyze(input,signal),
  onChange:(snapshot)=>{
    const oldRisk=ui.call.analysis?.risk;
    ui.call=snapshot;
    if(['playing','paused'].includes(snapshot.status))liveAudio?.setPaused(snapshot.status==='paused');
    else{liveAudio?.stop();callerController?.abort();clearTimeout(replyTimer);ui.callConnecting=false;ui.callPartial='';ui.callAudioStatus='Audio stopped. Microphone released.';ui.callerTrust='unknown';}
    const workspace=document.querySelector('#call-workspace');
    if(workspace){
      const action=workspace.contains(document.activeElement)?document.activeElement?.dataset.action:null;
      const reviewing=document.activeElement?.classList.contains('transcript');
      const previousScroll=reviewing?document.activeElement.scrollTop:0;
      workspace.innerHTML=views.callWorkspace(client.state,ui);
      for(const id of ['scenario','call-mode','caller-trust']){const selector=document.querySelector('#'+id);if(selector){selector.disabled=['playing','paused'].includes(snapshot.status)||ui.callConnecting;if(id==='caller-trust')selector.value=ui.callerTrust;}}
      const transcript=workspace.querySelector('.transcript');
      if(transcript)transcript.scrollTop=reviewing?previousScroll:transcript.scrollHeight;
      if(oldRisk!==snapshot.analysis.risk&&snapshot.analysis.risk==='unknown')document.querySelector('#call-announcement').textContent=riskLabels.unknown+'. Keep verifying independently.';
      if(action)restoreCallFocus(action);
      if(reviewing)restoreTranscriptFocus(previousScroll);
    }
    const active=['playing','paused'].includes(snapshot.status);
    if(!active){warningDialog.close();callAudio.stop();}
    const support=emotionWarning(snapshot.analysis,snapshot.callerTrust);
    const dialogSupport=warningDialog.querySelector('#call-warning-emotion');
    if(dialogSupport){dialogSupport.textContent=support||'';dialogSupport.hidden=!support;}
    if(active&&route().name==='calls'&&snapshot.emotionAlert&&snapshot.emotionAlert.id!==lastEmotionAlertId){
      lastEmotionAlertId=snapshot.emotionAlert.id;
      const announcement=document.querySelector('#call-announcement');
      if(announcement)announcement.textContent=support;
      if(snapshot.analysis.risk!=='high')callAudio.play('emotion',snapshot.emotionAlert.emotion);
    }
    if(active&&route().name==='calls'&&snapshot.alert&&snapshot.alert.id!==lastCallAlertId){
      lastCallAlertId=snapshot.alert.id;
      const announcement=document.querySelector('#call-announcement');
      if(announcement)announcement.textContent=(snapshot.alert.risk==='high'?'High-risk warning. The practice call is paused. Verify the caller independently.':'Caution. Pressure or urgency deserves a second look.')+(support?' '+support:'');
      if(snapshot.alert.risk==='high')openCallWarning();
      callAudio.play(snapshot.alert.risk);
    }
  },
});
function refreshCallStatus(){
  const status=document.querySelector('#live-audio-status');if(status)status.textContent=ui.callAudioStatus;
  const partial=document.querySelector('#live-audio-partial');if(partial)partial.textContent=ui.callPartial;
}
liveAudio=new LiveAudio({
  request:(body,signal,audio)=>client.callApi(body,signal,audio),
  onTranscript:(text,speaker)=>{
    ui.callPartial='';session.ingest(text,speaker);refreshCallStatus();
    if(ui.callMode==='practice'&&speaker==='user'&&ui.call.status==='playing'){
      clearTimeout(replyTimer);replyTimer=setTimeout(()=>replyToUser(),850);
    }
  },
  onPartial:(text,speaker)=>{ui.callPartial=text?(speaker==='contact'?'Caller: ':'You: ')+text:'';refreshCallStatus();},
  onStatus:status=>{ui.callAudioStatus=status;refreshCallStatus();},
  onError:error=>{session.end();ui.callAudioStatus=error.message;render();notify(error.message,true);},
});
async function replyToUser(){
  if(callerBusy||ui.callMode!=='practice'||ui.call.status!=='playing')return;
  callerBusy=true;const operation=callOperation;
  callerController=new AbortController();ui.callAudioStatus='AI caller preparing a response…';refreshCallStatus();
  try{
    const result=await client.callApi({action:'reply',scenarioId:ui.scenario,turns:ui.call.turns.map(({speaker,text})=>({speaker,text}))},callerController.signal);
    if(operation===callOperation&&ui.call.status==='playing')await liveAudio.speak(result.text);
  }catch(error){if(operation===callOperation&&error.name!=='AbortError'){session.end();ui.callAudioStatus=error.message;render();notify(error.message,true);}}
  finally{if(operation===callOperation)callerBusy=false;}
}
async function startLiveCall(){
  const operation=++callOperation;callerController?.abort();callerBusy=false;
  ui.callConnecting=true;ui.callAudioStatus='Starting live audio…';ui.callPartial='';
  session.startLive(ui.callMode,{callerTrust:ui.callerTrust});render();
  try{
    await callAudio.prepare();
    if(operation!==callOperation||ui.call.status!=='playing')return;
    await liveAudio.start(ui.callMode);
    if(operation!==callOperation||!['playing','paused'].includes(ui.call.status))return;
    ui.callConnecting=false;render();restoreCallFocus('pause');
    if(ui.callMode==='practice')await replyToUser();
  }catch(error){
    if(operation===callOperation&&error.name!=='AbortError'){session.end();ui.callAudioStatus=error.message;render();notify(error.message,true);}
  }finally{if(operation===callOperation){ui.callConnecting=false;render();}}
}
function openCallWarning() {
  warningDialog.innerHTML=views.callWarningDialog(ui.call,client.state);
  if(!warningDialog.open)warningDialog.showModal();
}
function closeCallWarning(resume=false) {
  warningDialog.close();callAudio.stop();
  if(resume){session.resume();ui.callAudioStatus=ui.callMode==='practice'?'Your turn · Reply aloud':'Listening · Speak near your microphone';refreshCallStatus();}
  document.querySelector(ui.call.status==='paused'?'[data-action="resume"]':ui.call.status==='playing'?'[data-action="pause"]':'[data-action="start-call"]')?.focus();
}
warningDialog.addEventListener('cancel',event=>{event.preventDefault();closeCallWarning();});
warningDialog.addEventListener('click',event=>{
  if(event.target.closest('a[href^="tel:"]'))closeCallWarning();
});
client.subscribe((state)=>{
  if(state.user?.emailVerified&&!state.demo&&route().name==='account')location.hash='/home';
  render();
});
window.addEventListener('hashchange',()=>{
  ui.menuOpen=false;
  if(route().name!=='calls'&&['playing','paused'].includes(ui.call.status)){++callOperation;callerBusy=false;session.end();}
  render();window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('main')?.focus({preventScroll:true});
});
window.addEventListener('pagehide',()=>{liveAudio.stop();callerController?.abort();session.end(false);});
async function analyzeProfile() {
  const operation=++ui.profileOperation;
  ui.profileBusy=true;render();
  try {
    const result=await client.assess();
    if(operation===ui.profileOperation&&result)notify('Assessment ready.');
  } finally {
    if(operation===ui.profileOperation){ui.profileBusy=false;render();}
  }
}
async function changeConsent(enabled,historySetId) {
  ++ui.profileOperation;ui.profileBusy=false;
  await client.setConsent(enabled,historySetId);
  if(enabled)await analyzeProfile();
  else notify('Advanced analysis is off. Your assessment has been removed.');
}
document.addEventListener('click',async(event)=>{
  const skip=event.target.closest('.skip-link');
  if(skip){event.preventDefault();document.querySelector('main')?.focus();return;}
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const action=button.dataset.action;
  if(button.tagName==='A')event.preventDefault();
  // Call state already protects startup and playback. Ending a call cancels
  // those operations, even if a browser audio promise has not settled yet.
  const tracked=action!=='start-call';
  if(tracked)pendingActions++;
  try {
    switch(action){
      case 'dismiss':document.querySelector('#notifications').innerHTML='';break;
      case 'toggle-menu':ui.menuOpen=!ui.menuOpen;render();document.querySelector('[data-action="toggle-menu"]')?.focus({preventScroll:true});break;
      case 'enter-demo':client.enterDemo();location.hash='/home';break;
      case 'auth-mode':ui.authMode=button.dataset.mode;render();break;
      case 'start-call':await startLiveCall();break;
      case 'pause':session.pause();break;
      case 'resume':session.resume();ui.callAudioStatus=ui.callMode==='practice'?'Your turn · Reply aloud':'Listening · Speak near your microphone';refreshCallStatus();break;
      case 'end-call':++callOperation;callerBusy=false;session.end();closeCallWarning();break;
      case 'keep-call-paused':closeCallWarning();break;
      case 'continue-call':closeCallWarning(true);break;
      case 'review-call-warning':session.pause();openCallWarning();break;
      case 'pause-to-verify':session.pause();callAudio.stop();document.querySelector('.call-guidance')?.focus();break;
      case 'message-sample':ui.messageText=messageSamples[Number(button.dataset.index)].text;ui.messageResult=null;render();document.querySelector('#message-text')?.focus();break;
      case 'analyze-profile':await analyzeProfile();break;
      case 'delete-assessment':++ui.profileOperation;ui.profileBusy=false;await client.deleteAssessment();notify('Assessment deleted from both profile views.');break;
      case 'delete-contact':await client.deleteContact();notify('Trusted contact removed.');break;
      case 'delete-incident':await client.deleteIncident(button.dataset.id);notify('Check deleted.');break;
      case 'logout':session.end();ui.messageText='';ui.messageResult=null;await client.logout();location.hash='/account';break;
      case 'google':button.disabled=true;await client.google();break;
      case 'resend-verification':button.disabled=true;await client.resend();notify('Verification email sent. Please check your inbox.');break;
      case 'check-verification':button.disabled=true;await client.refreshVerification();break;
      case 'retry-account':window.location.reload();break;
      case 'skip-onboarding':await client.setConsent(false,'pressure');break;
    }
  }catch(error){notify(friendlyAuthError(error),true);}
  finally{if(tracked)pendingActions--;if(button.isConnected)button.disabled=false;}
});
document.addEventListener('input',(event)=>{
  if(event.target.id==='message-text')ui.messageText=event.target.value;
});
document.addEventListener('change',async(event)=>{
  const element=event.target;
  pendingActions++;
  try{
    if(element.id==='scenario'){
      ui.scenario=element.value;ui.callerTrust='unknown';session.end(false);
      ui.call={status:'idle',turns:[],analysis:{risk:'low',reasons:[]}};render();
    }
    if(element.id==='call-mode'){
      ++callOperation;session.end(false);liveAudio.stop();callerController?.abort();callerBusy=false;
      ui.callMode=element.value;ui.callerTrust='unknown';ui.callAudioStatus='';ui.callPartial='';
      ui.call={status:'idle',turns:[],analysis:{risk:'unknown',reasons:[]}};render();
    }
    if(element.id==='call-alert-audio'){
      ui.callAudio=element.value;ui.audioUnavailable=false;
      const status=document.querySelector('#call-audio-status');if(status)status.textContent='';
      try{localStorage.setItem('tsecure:call-alert-audio',ui.callAudio);}catch{/* Optional preference. */}
      await callAudio.setMode(ui.callAudio);
    }
    if(element.id==='caller-trust'&&!['playing','paused'].includes(ui.call.status)&&!ui.callConnecting)ui.callerTrust=element.value;
    if(element.id==='advanced')await changeConsent(element.checked,client.state.consent.historySetId);
    if(element.id==='history-set')await changeConsent(true,element.value);
    if(element.id==='recovery-topic'){ui.recoveryTopic=element.value;render();}
    if(element.name==='recovery-step'){
      const steps=[...document.querySelectorAll('[name="recovery-step"]:checked')].map((input)=>input.value);
      const id=route().id;
      const previous=id?client.state.incidents.find((item)=>item.id===id)?.recovery||[]:ui.recoverySteps;
      const visible=[...document.querySelectorAll('[name="recovery-step"]')].map((input)=>input.value);
      const merged=[...previous.filter((step)=>!visible.includes(step)),...steps];
      if(id)await client.saveRecovery(id,merged);else ui.recoverySteps=merged;
    }
  }catch(error){notify(friendlyAuthError(error),true);render();}
  finally{pendingActions--;}
});
document.addEventListener('submit',async(event)=>{
  const form=event.target;
  if(!['message-form','auth-form','contact-form'].includes(form.id))return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;
  pendingActions++;
  try{
    if(form.id==='message-form'){
      ui.messageText=data.text;ui.messageBusy=true;ui.messageResult=null;render();
      const text=data.text;
      // Immediate checks never wait for the AI provider.
      ui.messageResult=analyzeText(text);render();
      try{
        const result=await client.analyze({channel:/^https?:\/\/\S+$/.test(text.trim())?'link':'message',text,sequence:1});
        if(ui.messageText===text)ui.messageResult=result;
      }catch(error){
        ui.messageResult.incomplete=true;
        if(ui.messageResult.risk==='low')ui.messageResult.risk='unknown';
        notify(friendlyAuthError(error),true);
      }finally{ui.messageBusy=false;render();}
    }
    if(form.id==='contact-form'){
      await client.saveContact({name:data.name.trim(),relationship:data.relationship.trim(),phone:data.phone.trim()});
      notify('Trusted contact saved.');
    }
    if(form.id==='auth-form'){
      if(ui.authMode==='signup')await client.signup({...data,advanced:form.elements.advanced.checked});
      else if(ui.authMode==='reset'){await client.reset(data.email);notify('If an account exists for that email, a reset link is on its way.');}
      else await client.login(data.email,data.password);
    }
  }catch(error){notify(friendlyAuthError(error),true);}
  finally{pendingActions--;if(submit.isConnected)submit.disabled=false;}
});
render();
client.init().catch((error)=>{client.state.loading=false;render();notify(friendlyAuthError(error),true);});
registerPwa({
  enabled:import.meta.env.PROD,
  isBusy:()=>pendingActions>0||client.state.loading||ui.messageBusy||ui.profileBusy
    ||ui.callConnecting||['playing','paused'].includes(ui.call.status)
    ||Boolean(ui.call.analyzing&&ui.call.status!=='ended'),
});
