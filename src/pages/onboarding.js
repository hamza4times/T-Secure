import { h, icon } from '../ui.js';

export const STEPS=['Welcome','Protection','Accessibility','Trusted contacts','Privacy','Done'];
export const WARNING_STYLES=[
  ['standard','Standard','A gentle banner for elevated risk, and a pause-and-review warning for high risk.'],
  ['high-only','Fewer interruptions','Only interrupt me for high risk. Elevated risk still shows on the screen, without a banner.'],
];
export const VERIFICATION_METHODS=[
  ['callback','Hang up and call back on a number I already have saved'],
  ['passphrase','Ask for our family passphrase'],
  ['other-channel','Check through another channel, like a text or video call'],
  ['ask-family','Ask another family member to confirm'],
];
export const TEXT_SIZES=[['standard','Standard'],['large','Large'],['largest','Largest']];
export const LANGUAGES=[['en','English'],['es','Español (interface translation planned; currently in English)']];
export const CONTACT_VERIFICATION=[['callback','Call them on their saved number'],['passphrase','Ask for our family passphrase'],['other-channel','Text or video call them']];

const radio=(name,value,current,label,detail='')=>`<label class="choice"><input type="radio" name="${name}" value="${h(value)}" ${current===value?'checked':''}><span><strong>${h(label)}</strong>${detail?`<small>${h(detail)}</small>`:''}</span></label>`;
const check=(name,value,checked,label,detail='')=>`<label class="choice"><input type="checkbox" name="${name}" value="${h(value)}" ${checked?'checked':''}><span><strong>${h(label)}</strong>${detail?`<small>${h(detail)}</small>`:''}</span></label>`;

export function preferenceFields(p,{withName=false,name=''}={}) {
  return {
    protection:`<fieldset><legend>When should T-Secure interrupt you?</legend>${WARNING_STYLES.map(([v,l,d])=>radio('warningStyle',v,p.warningStyle,l,d)).join('')}</fieldset>
      <fieldset><legend>How do you prefer to check a caller is really who they say?</legend><p class="field-help">Choose any that suit you. We’ll show these first in warnings.</p>${VERIFICATION_METHODS.map(([v,l])=>check('verificationMethods',v,p.verificationMethods.includes(v),l)).join('')}</fieldset>
      <fieldset><legend>Family passphrase</legend>${check('hasFamilyPassphrase','yes',p.hasFamilyPassphrase,'My family and I have agreed on a passphrase','A private word or question only your family knows. Never type the passphrase itself into T-Secure or any app.')}</fieldset>`,
    accessibility:`${withName?`<label for="pref-name">What should we call you?</label><input id="pref-name" name="displayName" maxlength="80" autocomplete="given-name" value="${h(name)}">`:''}
      <fieldset><legend>Text size</legend><div class="choice-row">${TEXT_SIZES.map(([v,l])=>radio('textSize',v,p.textSize,l)).join('')}</div></fieldset>
      <fieldset><legend>Display</legend>${check('highContrast','yes',p.highContrast,'High contrast','Darker text and stronger outlines.')}${check('reduceMotion','yes',p.reduceMotion,'Reduce motion','Turns off animations.')}</fieldset>
      <label for="pref-language">Preferred language</label><select id="pref-language" name="language">${LANGUAGES.map(([v,l])=>`<option value="${v}" ${p.language===v?'selected':''}>${h(l)}</option>`).join('')}</select>
      <label for="pref-audio">Call warning sound</label><select id="pref-audio" name="callAlertAudio"><option value="visual" ${p.callAlertAudio==='visual'?'selected':''}>Visual warnings only</option><option value="tone" ${p.callAlertAudio==='tone'?'selected':''}>Visual + gentle tone</option><option value="speech" ${p.callAlertAudio==='speech'?'selected':''}>Visual + spoken guidance</option></select>`,
  };
}
// Reads a preferences form into a validated preferences object.
export function readPreferences(form,current) {
  const data=new FormData(form);
  const next={...current};
  if(data.has('warningStyle'))next.warningStyle=data.get('warningStyle');
  if(form.querySelector('[name="verificationMethods"]'))next.verificationMethods=data.getAll('verificationMethods');
  if(form.querySelector('[name="hasFamilyPassphrase"]'))next.hasFamilyPassphrase=data.has('hasFamilyPassphrase');
  if(data.has('textSize'))next.textSize=data.get('textSize');
  if(form.querySelector('[name="highContrast"]'))next.highContrast=data.has('highContrast');
  if(form.querySelector('[name="reduceMotion"]'))next.reduceMotion=data.has('reduceMotion');
  if(data.has('language'))next.language=data.get('language');
  if(data.has('callAlertAudio'))next.callAlertAudio=data.get('callAlertAudio');
  return next;
}

export function contactForm(prefix='contact') {
  return `<form id="contact-form" class="contact-form"><label for="${prefix}-name">Name</label><input id="${prefix}-name" name="displayName" autocomplete="off" maxlength="80" placeholder="e.g. Jordan" required>
    <label for="${prefix}-relationship">Relationship <span class="optional-label">Optional</span></label><input id="${prefix}-relationship" name="relationshipLabel" maxlength="60" placeholder="e.g. Daughter, friend, neighbor">
    <label for="${prefix}-phone">Phone number</label><input id="${prefix}-phone" name="phone" type="tel" maxlength="30" placeholder="+1 (555) 000-0000" required>
    <label for="${prefix}-verify">How will you check it’s really them?</label><select id="${prefix}-verify" name="verificationPreference">${CONTACT_VERIFICATION.map(([v,l])=>`<option value="${v}">${h(l)}</option>`).join('')}</select>
    <button class="button secondary" type="submit">${icon('plus')}Save contact</button></form>`;
}
export function contactList(contacts) {
  if(!contacts.length)return '';
  return `<ul class="contact-list">${contacts.map((c)=>`<li><span class="avatar">${h(c.displayName.charAt(0).toUpperCase())}</span><div><strong>${h(c.displayName)}</strong><span>${h(c.relationshipLabel||'Trusted contact')} · ${h(c.phone)}</span><small>${h(CONTACT_VERIFICATION.find(([v])=>v===c.verificationPreference)?.[1]||'')}</small></div><button class="text-button destructive" data-action="delete-contact" data-id="${h(c.id)}" aria-label="Remove ${h(c.displayName)}">${icon('trash')}Remove</button></li>`).join('')}</ul>`;
}

export function onboarding(state,ui) {
  const {step,draft}=ui.onboarding;
  const fields=preferenceFields(draft.preferences,{withName:true,name:draft.displayName});
  const progress=`<ol class="stepper" aria-label="Setup progress">${STEPS.map((label,i)=>`<li class="${i<step?'done':i===step?'current':''}" ${i===step?'aria-current="step"':''}><span>${i<step?icon('check'):i+1}</span>${label}</li>`).join('')}</ol>`;
  const nav=(next='Continue')=>`<div class="onboarding-nav">${step>0?'<button class="button secondary" type="button" data-action="onboarding-back">Back</button>':''}<button class="button primary" type="submit">${next} ${icon('arrow')}</button></div>`;
  const bodies=[
    ()=>`<span class="task-symbol pink">${icon('shield')}</span><h1>Your Personal Protection Profile</h1><p>A few quick choices so T-Secure works the way you like. It takes about two minutes, and you can change anything later in Settings.</p>
      <ul class="check-list"><li>${icon('check')}How and when we warn you</li><li>${icon('check')}How you like to check a caller is genuine</li><li>${icon('check')}Text size and display</li><li>${icon('check')}Optional people you trust</li></ul>
      <p class="quiet-note">We won’t ask about your health, finances, or relationships, and we never score you.</p>${nav('Let’s begin')}`,
    ()=>`<h1>Protection preferences</h1><p>Warnings are always proportional to the evidence. Choose how noticeable they should be.</p>${fields.protection}${nav()}`,
    ()=>`<h1>Accessibility and language</h1><p>Changes apply right away so you can see them.</p>${fields.accessibility}${nav()}`,
    ()=>`<h1>Trusted contacts <span class="small-chip">Optional</span></h1><p>Someone you can call for a second opinion. It’s your choice whether to involve anyone. T-Secure never contacts them for you.</p>${contactList(state.contacts)}${state.contacts.length<5?contactForm('onboarding'):''}<form id="onboarding-form" data-step="3">${nav(state.contacts.length?'Continue':'Skip for now')}</form>`,
    ()=>`<h1>Privacy and consent</h1><div class="privacy-points"><section><h2>${icon('lock')}What we keep</h2><p>Your preferences, trusted contacts, and for each check: the date, risk level, warning categories, and what you chose to do.</p></section><section><h2>${icon('close')}What we don’t keep</h2><p>The text of your messages or call transcripts. They are analyzed, then discarded.</p></section><section><h2>${icon('spark')}How analysis works</h2><p>${state.demo?'In this demo, checks run in your browser.':'Text you submit is sent securely to our server and, when configured, to an AI provider (NVIDIA Nemotron via OpenRouter, or Google Gemini) for analysis. It is not used to profile you.'}</p></section><section><h2>${icon('heart')}What we never do</h2><p>Score how “vulnerable” you are, listen to real calls, block calls, or contact anyone without your say-so.</p></section></div>
      <label class="choice consent"><input type="checkbox" name="consent"><span><strong>I understand how T-Secure uses my information.</strong><small>You can delete your history or your account at any time in Settings.</small></span></label>${nav('Finish setup')}`,
    ()=>`<span class="task-symbol pink">${icon('check')}</span><h1>You’re all set${draft.displayName?', '+h(draft.displayName.split(' ')[0]):''}.</h1><p>Protection is on. A good first step: try a practice call to see how warnings work, or check a message you weren’t sure about.</p><div class="button-row"><a class="button primary" href="#/home">Go to my dashboard ${icon('arrow')}</a><a class="button secondary" href="#/calls">${icon('phone')}Try a practice call</a></div>`,
  ];
  return `<div class="onboarding-page" id="main" tabindex="-1"><header class="landing-top"><span class="brand"><span class="brand-mark">${icon('shield')}</span>T-Secure<span class="brand-period">.</span></span>${step<5?'<button class="text-button" data-action="skip-onboarding">Skip setup and use defaults</button>':''}</header>
    ${progress}<section class="onboarding-card">${step===3?bodies[3]():`<form id="onboarding-form" data-step="${step}">${bodies[step]()}</form>`}</section></div>`;
}
