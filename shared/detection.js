import { CATEGORIES, RISKS } from './schema.js';

const RULES = [
  ['credentials', 'high', /(?:read|send|share|tell|give|confirm).{0,35}?(?:password|verification code|one.time (?:code|password)|security code|pin number)/i],
  ['payment', 'high', /(?:send|buy|pay|purchase|transfer).{0,40}(?:gift cards?|cryptocurrency|bitcoin|crypto wallet)/i],
  ['remote', 'high', /(?:install|download|allow|enable).{0,45}(?:anydesk|teamviewer|remote (?:access|control)|screen.sharing)/i],
  ['authority', 'high', /(?:transfer|move).{0,35}(?:money|funds|savings).{0,45}(?:safe|secure|protect).{0,15}account/i],
  ['urgency', 'caution', /(?:arrest|jail|account (?:will be |is )?(?:locked|suspended|frozen)|within (?:10|ten|five|5) minutes|act now or)/i],
];
export function analyzeText(text = '') {
  const reasons = [];
  let risk = 'low';
  const add = (code, level, evidence) => {
    reasons.push({code, evidence, title: CATEGORIES[code].label});
    if (RISKS.indexOf(level) > RISKS.indexOf(risk)) risk = level;
  };
  for (const [code, level, pattern] of RULES) {
    for (const match of text.matchAll(new RegExp(pattern.source,'ig'))) {
      const prefix=text.slice(Math.max(0,match.index-40),match.index);
      if (/(?:never|do not|don't|will not|won't|not to|should not|shouldn't|refuse to)\s+(?:ever\s+)?$/i.test(prefix)) continue;
      add(code, level, match[0]);break;
    }
  }
  const secrecy = text.match(/(?:do not|don't|must not) tell (?:anyone|your (?:family|parents|bank))|keep (?:this|it|the payment) (?:a )?secret/i);
  const money = /money|pay|gift card|transfer|bitcoin/i.test(text);
  if (secrecy && money) add('secrecy', 'high', secrecy[0]);
  const family = text.match(/grand(?:ma|pa|son|daughter)|your (?:son|daughter|nephew|niece)|mom|mum|dad/i);
  if (family && money && (secrecy || /emergency|trouble|hospital|jail|hurt/i.test(text))) add('family', 'high', family[0]);
  const links = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const raw of links) {
    try {
      const url = new URL(raw);
      if (url.username || /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || /xn--/.test(url.hostname) || /(?:bit\.ly|tinyurl\.com)$/i.test(url.hostname)) add('link', 'caution', raw);
    } catch { add('link', 'caution', raw); }
  }
  return {risk, reasons, actions: risk === 'low' ? ['verify'] : ['pause', 'verify', 'contact'], analysisSource: 'rules-only'};
}
export function mergeAnalysis(...results) {
  const valid = results.filter(Boolean);
  const risk = valid.reduce((level, result) => RISKS.indexOf(result.risk) > RISKS.indexOf(level) ? result.risk : level, 'low');
  const seen = new Set();
  const reasons = valid.flatMap((result) => result.reasons || []).filter((reason) => {
    const key = reason.code + ':' + reason.evidence;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return {risk, reasons, actions: risk === 'low' ? ['verify'] : ['pause', 'verify', 'contact'], analysisSource: valid.some((r) => r.analysisSource === 'hybrid') ? 'hybrid' : 'rules-only'};
}
