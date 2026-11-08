// Conversation manipulation timeline and predictive risk.
// Observable tactics only: never a judgment of the caller's identity, personality,
// or the customer's state of mind. Predictions are estimates, never guarantees.

export const TACTICS = Object.freeze({
  trust: {label: 'Trust exploitation', explain: 'Claims a close relationship to lower your guard. A familiar name or voice can be imitated.'},
  authority: {label: 'Authority impersonation', explain: 'Claims to represent a bank, agency, or support team. Real organizations are fine with you calling back on a number you already know.'},
  fear: {label: 'Fear', explain: 'Introduces a threat or emergency, which makes it harder to stop and check.'},
  urgency: {label: 'Urgency', explain: 'Sets a deadline that leaves less time to think or verify.'},
  secrecy: {label: 'Secrecy', explain: 'Asks you not to tell anyone, which removes the people who could help you check.'},
  isolation: {label: 'Isolation', explain: 'Discourages contact with family, your bank, or others who could offer independent advice.'},
  verification: {label: 'Blocking verification', explain: 'Gives a reason you can’t check their identity the usual way, such as a broken phone or new number.'},
  financial: {label: 'Financial pressure', explain: 'Brings money into the conversation, often in forms that are hard to reverse.'},
});

// [tactic, confidence, pattern, kind?] — kind anchors a scam pattern below.
const SIGNALS = [
  ['trust', 'medium', /\b(?:hi|hello|hey),? (?:grandma|grandpa|nana|mom|mum|dad)\b|it(?:’|')?s me|(?:it is|it’s|it's|this is) your (?:grandson|granddaughter|son|daughter|nephew|niece)/i, 'family'],
  ['trust', 'medium', /\bmy (?:love|darling|dear)\b|we have never met/i, 'romance'],
  ['authority', 'high', /(?:security|fraud) (?:department|team) (?:at|of|from) your bank|calling from your bank/i, 'bank'],
  ['authority', 'high', /calling from the (?:federal|irs|tax|social security|police)[^.,]{0,25}|\b(?:tax office|internal revenue service|social security administration)\b/i, 'government'],
  ['authority', 'medium', /\b(?:technical|tech) support\b|we have detected a (?:problem|virus|issue) on your (?:computer|device)/i, 'support'],
  ['authority', 'medium', /^\s*(?:your )?bank(?: security| alert| fraud alert)?:|\b(?:bank|card) (?:security|fraud) alert\b|\byour bank account\b/i, 'bank'],
  ['authority', 'medium', /\b(?:delivery|package|parcel|shipment) (?:is )?(?:on hold|could not be delivered|is pending|was returned)|\b(?:USPS|UPS|FedEx|DHL)\b/i, 'delivery'],
  ['fear', 'high', /\b(?:warrant for your arrest|arrest(?:ed)?|jail|hospital|accident)\b/i],
  ['fear', 'medium', /\bin (?:big |serious )?trouble\b|unusual activity|suspicious activity|unauthori[sz]ed (?:transfer|charge|purchase|payment|login|sign.in)|(?:will be|is) (?:frozen|locked|suspended)|detected a (?:problem|virus|issue)|\bhacked\b/i],
  ['urgency', 'high', /within (?:\d+|one|two|five|ten|fifteen|thirty) (?:minutes|hours)|act now|before it(?:’|')?s too late/i],
  ['urgency', 'medium', /\b(?:it is an|it’s an|it's an) emergency\b|\bright away\b|\bimmediately\b|\b(?:verify|confirm|pay|respond|reply) (?:now|today)\b/i],
  ['urgency', 'low', /\bnow\b(?=\s*[.!,]|\s*$)/i],
  ['secrecy', 'high', /(?:do not|don’t|don't|must not) tell (?:anyone|anybody|mom|dad|grandma|grandpa|my (?:parents|mom|dad)|your (?:family|parents|bank|kids|children))|keep (?:this|it) (?:a )?secret|between (?:you and me|us)\b/i],
  ['isolation', 'high', /(?:do not|don’t|don't) (?:call|contact|tell|talk to) (?:my|your) (?:parents|family|bank|kids|children|son|daughter)|before they find out|(?:do not|don’t|don't) hang up|stay on the line/i],
  ['verification', 'medium', /my (?:phone|cell) (?:broke|is broken|died)|(?:lost|broke) my phone|this is my new number|from a (?:friend’s|friend's|friends|different|new) (?:number|phone)|you can(?:not|’t|'t) call me back|no time to (?:check|verify|call)|(?:only )?reply (?:only )?(?:to this (?:number|message)|here)/i],
  ['financial', 'high', /(?:buy|purchase|send|pay|transfer|wire|move)\b.{0,30}(?:gift cards?|money|bitcoin|crypto\w*|savings|funds|\$\d+)|\bneed \$\d[\d,]*|(?:settle|pay) (?:your|the|this) (?:debt|fee|fine|invoice)|\bpay (?:a |the )?(?:small |outstanding |redelivery )?(?:fee|fine|toll|balance)/i],
];

// Harmful next actions. Once requested, a prediction is marked as confirmed.
export const NEXT_ACTIONS = Object.freeze({
  payment: {label: 'Send or move money', pattern: /(?:buy|purchase|send|pay|transfer|wire|move)\b.{0,30}(?:gift cards?|bitcoin|crypto\w*|money|savings|funds)|safe account|pay with|\bneed \$\d[\d,]*/i},
  credentials: {label: 'Share a verification code or password', pattern: /(?:read|send|share|tell|give|confirm|reply with|enter)\b.{0,35}(?:password|verification code|security code|one.time (?:code|password)|\bpin\b|\d.digit code)/i},
  remote: {label: 'Install remote-access software', pattern: /(?:install|download|enable|allow)\b.{0,40}(?:anydesk|teamviewer|remote (?:access|control)|screen.sharing)/i},
  link: {label: 'Open a link', pattern: /(?:click|tap|open)\b.{0,25}(?:link|website)|https?:\/\/[^\s<>"']+/i},
  personal: {label: 'Reveal personal information', pattern: /social security number|date of birth|account number|card (?:number|details)|mother(?:’|')?s maiden name/i},
});

const PATTERNS = {
  family: {name: 'Family emergency pattern', next: ['payment'], prediction: 'Ask you to send money or gift cards', followUp: 'Press for more money and discourage you from checking with family', advice: 'Hang up and call your family member on the number you already have saved, even if the voice sounds right.'},
  romance: {name: 'Relationship pressure pattern', next: ['payment'], prediction: 'Ask you to send money for an emergency', followUp: 'Ask for more money, often with a new reason', advice: 'Talk to someone you trust before sending money to anyone you haven’t met in person.'},
  bank: {name: 'Bank impersonation pattern', next: ['payment', 'credentials'], prediction: 'Ask you to move money to a “safe account” or read out a verification code', followUp: 'Ask for a code or more account details', advice: 'Don’t respond. Contact your bank using the number on the back of your card. Your bank will never ask you to move money or share a code to protect your account.'},
  government: {name: 'Government impostor pattern', next: ['payment'], prediction: 'Demand immediate payment in gift cards, crypto, or a wire transfer', followUp: 'Raise the amount or the threat', advice: 'Government agencies send written notices and never demand gift cards or crypto. Look up the agency’s official number yourself.'},
  support: {name: 'Tech-support pattern', next: ['remote'], prediction: 'Ask you to install remote-access software', followUp: 'Ask for your password or a payment for the “repair”', advice: 'Don’t install anything. Real support companies don’t make unexpected calls about your computer.'},
  delivery: {name: 'Delivery fee pattern', next: ['link', 'payment'], prediction: 'Send you to a fake payment page to collect card details', followUp: 'Ask for your card number or charge more “fees”', advice: 'Don’t use the link. Check the tracking number in the carrier’s official app, or on its website typed in yourself.'},
  credentials: {name: 'Verification code theft pattern', next: ['credentials'], prediction: 'Ask you for a verification code', followUp: 'Use the code to sign in to your account or approve a transfer', advice: 'Never share a code you didn’t request. Contact the company through its official app or the number on your card.'},
  generic: {name: 'Pressure pattern', next: ['payment', 'credentials', 'personal'], prediction: 'Ask for money, a code, or personal information', followUp: 'Escalate the pressure or ask for more', advice: 'Pause the conversation and verify independently using a number you already know.'},
};

const PROTECTIVE = new Set(['secrecy', 'isolation', 'verification']);
const NEGATION = /(?:never|do not|don't|don’t|will not|won't|not to|should not|refuse to)\s+(?:ever\s+)?$/i;
const STRENGTH_LABELS = {possible: 'Possible', likely: 'Likely', strong: 'Strongly indicated'};
const LEVELS = ['low', 'caution', 'high'];

function elapsed(turn, first) {
  const ms = Math.max(0, new Date(turn.timestamp) - new Date(first.timestamp)) || 0;
  const s = Math.round(ms / 1000);
  return Number.isFinite(s) ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : null;
}

function matchOutside(pattern, text) {
  for (const match of text.matchAll(new RegExp(pattern.source, 'ig'))) {
    if (!NEGATION.test(text.slice(Math.max(0, match.index - 40), match.index))) return match;
  }
  return null;
}

// turns: [{speaker:'contact'|'user', text, timestamp?}]
export function analyzeConversation(turns = []) {
  const findings = [];
  const requests = [];
  const kinds = new Map();
  const seen = new Set();
  const first = turns[0];
  turns.forEach((turn, index) => {
    if (turn.speaker !== 'contact' || typeof turn.text !== 'string') return;
    for (const [tactic, confidence, pattern, kind] of SIGNALS) {
      const match = matchOutside(pattern, turn.text);
      if (!match) continue;
      if (kind && !kinds.has(kind)) kinds.set(kind, index);
      // One finding per tactic per turn keeps the timeline readable.
      if (seen.has(tactic + ':' + index)) continue;
      seen.add(tactic + ':' + index);
      findings.push({tactic, label: TACTICS[tactic].label, excerpt: match[0], explanation: TACTICS[tactic].explain, turn: index + 1, index: match.index, time: first?.timestamp && turn.timestamp ? elapsed(turn, first) : null, confidence});
    }
    for (const [code, action] of Object.entries(NEXT_ACTIONS)) {
      if (requests.some((r) => r.code === code)) continue;
      const match = matchOutside(action.pattern, turn.text);
      if (match) requests.push({code, label: action.label, excerpt: match[0], turn: index + 1});
    }
  });

  const tactics = new Set(findings.map((f) => f.tactic));
  const pressure = ['fear', 'urgency', 'secrecy', 'isolation', 'verification', 'financial'].filter((t) => tactics.has(t));
  const anchor = [...kinds.entries()].sort((a, b) => a[1] - b[1])[0]?.[0]
    || (requests.some((r) => r.code === 'credentials') && findings.length ? 'credentials' : null)
    || (pressure.length >= 2 ? 'generic' : null);

  let prediction = null;
  if (anchor) {
    const pattern = PATTERNS[anchor];
    const supporting = pressure.filter((t) => t !== 'financial' || anchor === 'generic');
    const protectiveBlocked = supporting.some((t) => PROTECTIVE.has(t));
    const strength = anchor === 'generic'
      ? (protectiveBlocked && supporting.length >= 3 ? 'strong' : supporting.length >= 2 ? 'likely' : 'possible')
      : supporting.length >= 2 && (protectiveBlocked || (tactics.has('fear') && tactics.has('urgency'))) ? 'strong'
        : supporting.length >= 1 ? 'likely' : 'possible';
    const confirmed = requests.find((r) => pattern.next.includes(r.code)) || null;
    const evidence = [...new Map(findings.map((f) => [f.tactic, f])).values()].slice(0, 4);
    prediction = {
      pattern: anchor, name: pattern.name, strength, strengthLabel: STRENGTH_LABELS[strength],
      action: confirmed ? pattern.followUp : pattern.prediction,
      predictedAction: pattern.prediction, followUp: pattern.followUp,
      confirmed,
      evidence, advice: pattern.advice,
      uncertainty: 'An estimate based on common scam patterns, not a certainty. Some genuine calls and messages use similar words.',
    };
  }

  // Graduated level: proportional to evidence so ordinary calls stay quiet.
  // A link or a single request with no surrounding pressure is never enough for a high warning.
  const severe = requests.some((r) => ['payment', 'credentials', 'remote'].includes(r.code));
  const softer = requests.some((r) => ['link', 'personal'].includes(r.code));
  let level = 'low';
  if (prediction?.strength === 'strong' || (severe && findings.length) || (softer && findings.length >= 2)) level = 'high';
  else if (prediction?.strength === 'likely' || pressure.length >= 2 || severe || (softer && findings.length)) level = 'caution';

  return {level, findings, requests, prediction, orgs: [...kinds.keys()]};
}

export function maxLevel(a = 'low', b = 'low') {
  return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}

// Call transcripts arrive as "contact: …" / "user: …" lines; anything else is one incoming message.
export function turnsFromText(text = '') {
  const lines = text.split('\n');
  if (!lines.some((line) => /^(contact|user): /.test(line))) return [{speaker: 'contact', text}];
  return lines.filter((line) => /^(contact|user): /.test(line)).map((line) => ({speaker: line.startsWith('contact') ? 'contact' : 'user', text: line.replace(/^(contact|user): /, '')}));
}

// A model can raise a deterministic rating by at most one level, so an LLM response
// alone never decides the final risk.
export function combineRisk(deterministic = 'low', model = 'low') {
  const d = Math.max(0, LEVELS.indexOf(deterministic));
  const m = LEVELS.indexOf(model);
  return m <= d ? LEVELS[d] : LEVELS[Math.min(m, d + 1)];
}
