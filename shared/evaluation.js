// Model evaluation: fixed synthetic scenarios with hand-written expected labels, and the
// scoring used for every engine. Results are computed from real runs only. Nothing here
// is a pre-filled or estimated accuracy figure.
//
// Caveat shown in the UI: the rule baseline was written alongside these scenarios, so its
// results are optimistic. Twelve synthetic scenarios cannot validate real-world accuracy.
import { scenarios, messageSamples } from './fixtures.js';
import { analyzeConversation, turnsFromText, contactText } from './prediction.js';
import { analyzeText } from './detection.js';
import { buildReport, ACTION_CODES } from './report.js';

const transcript = (id) => scenarios.find((s) => s.id === id).turns.map(([speaker, text]) => speaker + ': ' + text).join('\n');
const sms = (name) => messageSamples.find((m) => m.name === name).text;

// expected.risk lists every acceptable level. tactics use prediction.js keys.
export const EVALUATION_SCENARIOS = [
  {id: 'call-family-a', type: 'call', title: 'Family emergency (Scenario A)', text: transcript('family'), expected: {scam: true, risk: ['high'], tactics: ['trust', 'fear', 'urgency', 'secrecy', 'financial'], next: 'payment'}},
  {id: 'sms-bank-b', type: 'sms', title: 'Bank suspension text (Scenario B)', text: sms('Scenario B · Bank suspension'), expected: {scam: true, risk: ['high'], tactics: ['authority', 'fear', 'urgency'], next: 'link'}},
  {id: 'call-genuine-c', type: 'call', title: 'Urgent but genuine family call (Scenario C)', text: transcript('legitimate'), expected: {scam: false, risk: ['low'], tactics: [], next: null}},
  {id: 'call-bank', type: 'call', title: 'Bank “safe account” call', text: transcript('bank'), expected: {scam: true, risk: ['high'], tactics: ['authority', 'fear', 'urgency'], next: 'payment'}},
  {id: 'call-government', type: 'call', title: 'Tax office arrest threat', text: transcript('government'), expected: {scam: true, risk: ['high'], tactics: ['authority', 'fear', 'urgency', 'financial'], next: 'payment'}},
  {id: 'call-support', type: 'call', title: 'Remote-access support call', text: transcript('support'), expected: {scam: true, risk: ['high'], tactics: ['authority', 'fear'], next: 'remote'}},
  {id: 'call-checkin', type: 'call', title: 'Lunch check-in', text: transcript('checkin'), expected: {scam: false, risk: ['low'], tactics: [], next: null}},
  {id: 'sms-code', type: 'sms', title: 'One-time code request', text: sms('One-time code request'), expected: {scam: true, risk: ['high', 'caution'], tactics: ['fear'], next: 'credentials'}},
  {id: 'sms-romance', type: 'sms', title: 'Romance gift-card pressure', text: sms('Romance pressure'), expected: {scam: true, risk: ['high'], tactics: ['trust', 'secrecy', 'financial'], next: 'payment'}},
  {id: 'sms-pharmacy', type: 'sms', title: 'Pharmacy pickup deadline', text: sms('Urgent but genuine'), expected: {scam: false, risk: ['low'], tactics: [], next: null}},
  {id: 'sms-party', type: 'sms', title: 'Surprise party secret', text: 'Keep the surprise party secret until Saturday! Bring a dessert if you can.', expected: {scam: false, risk: ['low'], tactics: [], next: null}},
  {id: 'sms-bank-notice', type: 'sms', title: 'Genuine bank safety notice', text: 'Reminder from your bank: we will never ask for your verification code. Never share it with anyone, even someone who says they work here.', expected: {scam: false, risk: ['low'], tactics: [], next: null}},
];

const ACTION_KEYS = Object.fromEntries(Object.entries(ACTION_CODES).map(([key, code]) => [code, key]));

// Rule baseline output in the same normalized shape as a validated model response.
export function runRules(text, type) {
  const insight = analyzeConversation(turnsFromText(text));
  const level = ['low', 'caution', 'high'][Math.max(['low', 'caution', 'high'].indexOf(insight.level), ['low', 'caution', 'high'].indexOf(analyzeText(contactText(text)).risk))];
  const report = buildReport({communicationType: type === 'sms' ? 'message' : 'call', level, insight});
  return {risk: level, tactics: [...new Set(insight.findings.map((f) => f.tactic))], next: report.predicted_next_action ? ACTION_KEYS[report.predicted_next_action.action] : null, explanation: report.explanation};
}

// result: {risk, tactics:[keys], next:key|null}
export function scoreResult(expected, result) {
  const predictedScam = ['caution', 'high'].includes(result.risk);
  const found = new Set(result.tactics);
  const hits = expected.tactics.filter((t) => found.has(t)).length;
  return {
    classificationCorrect: predictedScam === expected.scam,
    riskAcceptable: expected.risk.includes(result.risk),
    tacticRecall: expected.tactics.length ? hits / expected.tactics.length : null,
    // Tactics flagged on a non-scam scenario count against precision.
    tacticPrecision: found.size ? hits / found.size : expected.tactics.length ? 0 : null,
    nextActionCorrect: expected.next ? result.next === expected.next : result.next == null,
  };
}

const mean = (values) => { const v = values.filter((x) => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const median = (values) => { const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };

// runs: [{scenarioId, result|null, error|null, latencyMs, usage}]
export function summarize(runs) {
  const completed = runs.filter((r) => r.result && r.score);
  const count = (key) => completed.filter((r) => r.score[key]).length;
  const benign = completed.filter((r) => !EVALUATION_SCENARIOS.find((s) => s.id === r.scenarioId)?.expected.scam);
  return {
    attempted: runs.length, completed: completed.length, failed: runs.length - completed.length,
    classification: {correct: count('classificationCorrect'), of: completed.length},
    riskLevel: {correct: count('riskAcceptable'), of: completed.length},
    nextAction: {correct: count('nextActionCorrect'), of: completed.length},
    benignKeptQuiet: {correct: benign.filter((r) => r.result.risk === 'low').length, of: benign.length},
    tacticRecall: mean(completed.map((r) => r.score.tacticRecall)),
    tacticPrecision: mean(completed.map((r) => r.score.tacticPrecision)),
    medianLatencyMs: median(runs.map((r) => r.latencyMs)),
    tokens: {input: runs.reduce((a, r) => a + (r.usage?.input || 0), 0), output: runs.reduce((a, r) => a + (r.usage?.output || 0), 0)},
    reportedCost: runs.some((r) => typeof r.usage?.cost === 'number') ? runs.reduce((a, r) => a + (r.usage?.cost || 0), 0) : null,
  };
}
