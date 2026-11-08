// Engine 5: Scam Network Intelligence.
// Correlates derived indicators (never raw text) across the customer's own checks
// and a controlled, synthetic demo campaign dataset. A match explains exactly which
// indicators are shared and never claims two communications are definitely connected.
// The fingerprint shape is the extension point for future privacy-preserving,
// aggregated threat intelligence; no carrier-wide data is used here.
import { analyzeConversation, turnsFromText } from './prediction.js';

export const FINGERPRINT_VERSION = 1;
const ORG_LABELS = {family: 'A family member', romance: 'A romantic partner', bank: 'Your bank', government: 'A government agency', support: 'Technical support', delivery: 'A delivery service'};
const REQUEST_LABELS = {payment: 'money or gift cards', credentials: 'a verification code or password', remote: 'remote access to a device', link: 'opening a link', personal: 'personal information'};
const STRENGTH = {possible: 'Possible link', moderate: 'Moderate match', strong: 'Strong match'};

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
const digits = (value) => value.replace(/\D/g, '');
function phoneKey(value) {
  const d = digits(value);
  return d.length >= 7 ? d.slice(-10) : null;
}
// Only the other party's words count; the customer's replies are never fingerprinted.
const contactText = (text) => turnsFromText(text).filter((t) => t.speaker === 'contact').map((t) => t.text).join('\n');
function wording(text) {
  const words = text.toLowerCase().replace(/https?:\/\/\S+/g, ' link ').replace(/\d+/g, ' 0 ').replace(/[^a-z0-9’' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const shingles = new Set();
  for (let i = 0; i + 2 < words.length; i++) shingles.add(hash(words.slice(i, i + 3).join(' ')));
  return [...shingles].slice(0, 240);
}
function domainsIn(text) {
  const found = new Set();
  for (const raw of text.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    try { found.add(new URL(raw).hostname.toLowerCase().replace(/^www\./, '')); } catch { /* Unparseable links are handled by detection rules. */ }
  }
  for (const bare of text.match(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|xyz|top|co|io|us|biz|example)\b/gi) || []) found.add(bare.toLowerCase().replace(/^www\./, ''));
  return [...found].slice(0, 10);
}

// Derived indicators only: identifiers, domains, codes, and hashed wording fingerprints.
export function extractIndicators({text = '', sender = ''} = {}) {
  const spoken = contactText(text);
  const insight = analyzeConversation([{speaker: 'contact', text: spoken}]);
  const ids = new Set();
  const senderKey = sender ? phoneKey(sender) || sender.trim().toLowerCase().slice(0, 40) : null;
  if (senderKey) ids.add(senderKey);
  for (const number of spoken.match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || []) ids.add(phoneKey(number));
  return {
    v: FINGERPRINT_VERSION, ids: [...ids].filter(Boolean).slice(0, 6), domains: domainsIn(spoken),
    orgs: insight.orgs, requests: insight.requests.map((r) => r.code), tactics: [...new Set(insight.findings.map((f) => f.tactic))],
    wording: wording(spoken),
  };
}

// All campaigns, numbers, and domains are synthetic. 555-01xx numbers and .example
// domains are reserved for fiction and documentation.
export const DEMO_CAMPAIGNS = [
  {id: 'bank-lock', name: 'Account-lock bank impersonation', org: 'bank', summary: 'Texts and calls claiming your bank account is suspended, then asking for a verification code or a transfer to a “safe account.”',
    ids: ['+1 (555) 014-2290', '+1 (555) 014-7731'], domains: ['secure-bank-verify.example', 'bank-account-restore.example'],
    scripts: ['Bank Security: Your account is suspended. Send your verification code to restore access today.', 'Bank Alert: Unusual sign-in on your bank account. Your account is suspended. Verify now at secure-bank-verify.example', 'This is the security department at your bank. We noticed unusual activity. Read me your verification code so I can protect your account.'],
    related: [['Sender', '+1 (555) 014-7731', 'Texted “account suspended” alerts in the demo dataset.'], ['Caller', '+1 (555) 014-2290', 'Called as “bank security” and asked for verification codes.'], ['Domain', 'secure-bank-verify.example', 'Look-alike sign-in page that collects passwords and codes.'], ['Request', 'Verification code', 'A code lets someone sign in to your account as you.']]},
  {id: 'delivery-fee', name: 'Delivery fee text campaign', org: 'delivery', summary: 'Texts saying a package is on hold until you pay a small fee through a link.',
    ids: ['+1 (555) 016-3318'], domains: ['192.0.2.1', 'redelivery-fee.example'],
    scripts: ['Your delivery is on hold. Pay a small fee within ten minutes to release it.', 'Your package could not be delivered. Pay the redelivery fee today at redelivery-fee.example'],
    related: [['Sender', '+1 (555) 016-3318', 'Sent “delivery on hold” texts in the demo dataset.'], ['Domain', '192.0.2.1', 'A raw number address instead of a carrier website, often used to hide the real destination.'], ['Domain', 'redelivery-fee.example', 'Fake payment page that collects card details.']]},
  {id: 'grandparent', name: 'Grandparent emergency calls', org: 'family', summary: 'Callers posing as a grandchild in trouble, asking for gift cards and secrecy.',
    ids: ['+1 (555) 019-8804'],
    scripts: ['Hi Grandma, it is your grandson. My phone broke, so I am calling from a friend’s number. I am in trouble and need your help. Please do not tell anyone. I need you to buy gift cards and send me the codes now.'],
    related: [['Caller', '+1 (555) 019-8804', 'Called as a grandchild “from a friend’s phone” in the demo dataset.'], ['Request', 'Gift card codes', 'Gift card payments are fast and nearly impossible to reverse.']]},
  {id: 'tax-arrest', name: 'Tax office arrest threat', org: 'government', summary: 'Callers claiming to be a tax office, threatening arrest unless you pay immediately in crypto.',
    ids: ['+1 (555) 012-1176'],
    scripts: ['I am calling from the federal tax office. There is a warrant for your arrest unless you settle your debt. You must pay with bitcoin within five minutes.'],
    related: [['Caller', '+1 (555) 012-1176', 'Threatened arrest and demanded bitcoin in the demo dataset.'], ['Request', 'Bitcoin payment', 'Agencies never demand crypto, gift cards, or wire transfers.']]},
  {id: 'support-remote', name: 'Remote-access support scam', org: 'support', summary: 'Unexpected “support” calls asking you to install remote-control software, then for a password.',
    ids: ['+1 (555) 013-4452'], domains: ['pc-fix-support.example'],
    scripts: ['We have detected a problem on your computer. Download AnyDesk and enable remote access so I can fix it. Then send your password so I can finish the repair.'],
    related: [['Caller', '+1 (555) 013-4452', 'Asked for remote access in the demo dataset.'], ['Domain', 'pc-fix-support.example', 'Download page for remote-control software.'], ['Request', 'Remote access', 'Remote control lets someone see and use your device.']]},
  {id: 'romance-gift', name: 'Relationship gift-card pressure', org: 'romance', summary: 'Messages from someone you have never met, asking for gift cards and secrecy.',
    ids: ['+1 (555) 018-2207'],
    scripts: ['My love, we have never met but you are all I have. Send gift cards for my emergency and do not tell anyone.'],
    related: [['Sender', '+1 (555) 018-2207', 'Sent relationship-pressure messages in the demo dataset.'], ['Request', 'Gift cards and secrecy', 'Secrecy removes the people who could help you check.']]},
].map((campaign) => ({...campaign, fingerprint: {
  v: FINGERPRINT_VERSION, ids: campaign.ids.map(phoneKey), domains: campaign.domains || [], orgs: [campaign.org],
  requests: [...new Set(campaign.scripts.flatMap((s) => analyzeConversation([{speaker: 'contact', text: s}]).requests.map((r) => r.code)))],
  tactics: [...new Set(campaign.scripts.flatMap((s) => analyzeConversation([{speaker: 'contact', text: s}]).findings.map((f) => f.tactic)))],
  wording: [...new Set(campaign.scripts.flatMap(wording))],
}}));

function jaccard(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  const shared = a.filter((x) => set.has(x)).length;
  return shared / Math.min(a.length, b.length);
}

// Compare two fingerprints. Returns null unless at least one specific indicator
// (identifier, domain, or closely similar wording) or a strong contextual overlap is shared.
export function compareFingerprints(a, b) {
  if (!a || !b) return null;
  const shared = [];
  let score = 0;
  const ids = a.ids.filter((id) => b.ids.includes(id));
  if (ids.length) { score += 0.45; shared.push({type: 'Phone number or sender', detail: ids.map((id) => id.length === 10 ? '(' + id.slice(0, 3) + ') ' + id.slice(3, 6) + '-' + id.slice(6) : id).join(', '), why: 'The same number or sender name appears in both.'}); }
  const domains = a.domains.filter((d) => b.domains.includes(d));
  if (domains.length) { score += 0.45; shared.push({type: 'Website domain', detail: domains.join(', '), why: 'Both point to the same website address.'}); }
  const similarity = jaccard(a.wording, b.wording);
  if (similarity >= 0.25) { score += 0.15 + 0.4 * Math.min(1, similarity); shared.push({type: 'Similar wording', detail: Math.round(similarity * 100) + '% of phrases overlap', why: 'The messages reuse the same phrases, a sign of a shared script.'}); }
  const specific = shared.length > 0;
  const orgs = a.orgs.filter((o) => b.orgs.includes(o));
  if (orgs.length) { score += 0.15; shared.push({type: 'Impersonated identity', detail: orgs.map((o) => ORG_LABELS[o] || o).join(', '), why: 'Both claim to be the same kind of person or organization.'}); }
  const requests = a.requests.filter((r) => b.requests.includes(r));
  if (requests.length) { score += Math.min(0.2, 0.1 * requests.length); shared.push({type: 'Same request', detail: requests.map((r) => REQUEST_LABELS[r] || r).join(', '), why: 'Both ask for the same risky action.'}); }
  const tactics = a.tactics.filter((t) => b.tactics.includes(t));
  if (tactics.length >= 2) { score += 0.1; shared.push({type: 'Shared tactics', detail: tactics.length + ' manipulation tactics in common', why: 'Both use a similar mix of pressure.'}); }
  // Common context alone (e.g. two unrelated bank scams) is at most a possible link.
  const contextual = orgs.length && requests.length && tactics.length >= 2;
  if (!specific && !contextual) return null;
  const strength = !specific ? 'possible' : score >= 0.75 ? 'strong' : score >= 0.45 ? 'moderate' : 'possible';
  return {score: Math.min(1, score), strength, strengthLabel: STRENGTH[strength], shared};
}

export function findConnections(fingerprint, {incidents = [], excludeId = null} = {}) {
  const campaigns = DEMO_CAMPAIGNS.map((campaign) => ({campaign, match: compareFingerprints(fingerprint, campaign.fingerprint)}))
    .filter((r) => r.match).sort((a, b) => b.match.score - a.match.score).slice(0, 2)
    .map(({campaign, match}) => ({...match, id: campaign.id, name: campaign.name, summary: campaign.summary, related: campaign.related}));
  const history = incidents.filter((i) => i.id !== excludeId && i.indicators?.v === FINGERPRINT_VERSION)
    .map((incident) => ({incident, match: compareFingerprints(fingerprint, incident.indicators)}))
    .filter((r) => r.match).sort((a, b) => b.match.score - a.match.score).slice(0, 3)
    .map(({incident, match}) => ({...match, id: incident.id, channel: incident.channel, updatedAt: incident.updatedAt, risk: incident.risk}));
  return {campaigns, history, uncertainty: 'Shared indicators suggest these may be related. They do not prove the same people are behind them.'};
}

// Persist indicators only for warnings; ordinary contacts' numbers are never kept.
export function indicatorsToStore(fingerprint, risk) {
  return ['caution', 'high'].includes(risk) ? fingerprint : null;
}
