import { CATEGORIES, RISKS } from './schema.js';

const RULES = [
  ['credentials', 'high', /(?:read|send|share|tell|give|confirm).{0,35}?(?:password|verification code|one.time (?:code|password)|security code|pin number)/i],
  ['payment', 'high', /(?:send|buy|pay|purchase|transfer).{0,40}(?:gift cards?|cryptocurrency|bitcoin|crypto wallet)/i],
  ['remote', 'high', /(?:install|download|allow|enable).{0,45}(?:anydesk|teamviewer|remote (?:access|control)|screen.sharing)/i],
  ['authority', 'high', /(?:transfer|move).{0,35}(?:money|funds|savings).{0,45}(?:safe|secure|protect).{0,15}account/i],
  ['urgency', 'caution', /(?:arrest|jail|account (?:will be |is |has been )?(?:locked|suspended|frozen)|within (?:10|ten|five|5) minutes|act now or)/i],
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

// Structural link checks. Links are parsed as text and never opened or fetched.
const SHORTENERS = /(?:^|\.)(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|rb\.gy|cutt\.ly)$/i;
const LURE_WORDS = /(?:verify|secure|login|signin|account|update|unlock|restore|support|billing|refund)/i;
const BRAND_WORDS = /(?:bank|paypal|amazon|apple|usps|ups|fedex|dhl|irs|tmobile|t-mobile|netflix|chase|wellsfargo|citi)/i;
export function inspectLinks(text = '') {
  const found = [];
  for (const raw of text.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    const flags = [];
    let host = raw;
    try {
      const url = new URL(raw);
      host = url.hostname.toLowerCase();
      if (url.username || url.password) flags.push({code: 'userinfo', label: 'Hides the real destination after an “@” sign', severity: 'high'});
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) flags.push({code: 'ip', label: 'Uses a raw number address instead of a company website', severity: 'high'});
      if (/xn--/.test(host)) flags.push({code: 'punycode', label: 'Uses look-alike international characters', severity: 'high'});
      if (SHORTENERS.test(host)) flags.push({code: 'shortener', label: 'A link shortener hides where it leads', severity: 'medium'});
      if (url.protocol === 'http:') flags.push({code: 'insecure', label: 'Not a secure (https) address', severity: 'medium'});
      if (BRAND_WORDS.test(host) && LURE_WORDS.test(host)) flags.push({code: 'lookalike', label: 'Combines a company-style name with words like “verify” or “secure”, a common look-alike trick', severity: 'medium'});
      if (host.split('.').length > 4) flags.push({code: 'subdomains', label: 'Unusually many parts in the address', severity: 'low'});
    } catch { flags.push({code: 'malformed', label: 'The address is malformed', severity: 'medium'}); }
    found.push({url: raw, host, flags});
  }
  return {links: found, mentionsLinkWithoutUrl: !found.length && /\b(?:this|the following|the) link\b|\bclick here\b|\btap here\b/i.test(text)};
}
