// Structured analysis report: one JSON shape for every engine (rules, Nemotron, Gemini).
// Model output is untrusted. It is validated field by field, every quote must appear in
// the submitted text, and application code, never the model, decides safety advice.
import { TACTICS, NEXT_ACTIONS, riskScore } from './prediction.js';
import { CATEGORIES } from './schema.js';

export const TACTIC_NAMES = Object.freeze({
  urgency: 'urgency', fear: 'fear', authority: 'authority_impersonation', secrecy: 'secrecy',
  isolation: 'isolation', financial: 'financial_pressure', trust: 'trust_exploitation', verification: 'blocking_verification',
});
const TACTIC_ALIASES = {
  ...Object.fromEntries(Object.entries(TACTIC_NAMES).map(([key, name]) => [name, key])),
  ...Object.fromEntries(Object.keys(TACTIC_NAMES).map((key) => [key, key])),
  authority_impersonation: 'authority', impersonation: 'authority', family_impersonation: 'trust',
  financial_pressure: 'financial', payment_pressure: 'financial', trust_exploitation: 'trust',
  blocking_verification: 'verification', prevent_verification: 'verification', preventing_verification: 'verification',
};
export const ACTION_CODES = Object.freeze({
  payment: 'potential_payment_request', credentials: 'potential_verification_code_request',
  remote: 'potential_remote_access_request', link: 'potential_malicious_link', personal: 'potential_personal_information_request',
});
const ACTION_ALIASES = {...Object.fromEntries(Object.entries(ACTION_CODES).map(([key, code]) => [code, key])), ...Object.fromEntries(Object.keys(ACTION_CODES).map((k) => [k, k]))};
// Model tactics map onto the category vocabulary used for highlighting and history.
const TACTIC_CATEGORY = {urgency: 'urgency', fear: 'urgency', authority: 'authority', secrecy: 'secrecy', isolation: 'secrecy', financial: 'payment', trust: 'family'};
const LEVEL_ALIASES = {low: 'low', caution: 'caution', elevated: 'caution', medium: 'caution', high: 'high'};
// Rule confidences are fixed heuristic weights, not calibrated probabilities.
const RULE_CONFIDENCE = {low: 0.5, medium: 0.7, high: 0.85};
const STRENGTH_CONFIDENCE = {possible: 0.4, likely: 0.65, strong: 0.8};

const RECOMMENDED = {
  high: 'Do not send money, share codes, or follow links until you independently verify who this is, using a number you already trust.',
  caution: 'Pause before acting. Verify the request independently using a number or website you find yourself.',
  low: 'No clear warning signs. If anyone later asks for money, codes, or personal details, verify first.',
  unknown: 'Analysis is incomplete. Keep verifying independently before acting.',
};
export const recommendedFor = (level, prediction) => (['high', 'caution'].includes(level) && prediction?.advice) || RECOMMENDED[level] || RECOMMENDED.unknown;

function explain(level, tactics, prediction) {
  if (level === 'high') return `Multiple indicators of possible manipulation were detected (${tactics.length} ${tactics.length === 1 ? 'tactic' : 'tactics'}${prediction ? ', following a ' + prediction.name.toLowerCase() : ''}).`;
  if (level === 'caution') return 'Some warning signs are present, but not enough to be confident. Independent verification is recommended.';
  if (level === 'unknown') return 'The AI analysis could not finish and the rule checks found nothing clear.';
  return 'No request for money, codes, or personal details alongside pressure tactics was found. A single word is never enough to flag a conversation.';
}

// insight: analyzeConversation() output. level: final combined level. model: validateModelReport() output.
export function buildReport({communicationType = 'message', level, insight, model = null, source = 'rules', incomplete = false}) {
  const final = level || insight.level;
  const tactics = [];
  const seen = new Set();
  for (const f of insight.findings) {
    if (seen.has(f.tactic)) continue;
    seen.add(f.tactic);
    tactics.push({name: TACTIC_NAMES[f.tactic], label: f.label, evidence: f.excerpt, explanation: f.explanation, confidence: RULE_CONFIDENCE[f.confidence] ?? 0.5, stage: f.turn, source: 'rules'});
  }
  for (const t of model?.tactics || []) {
    if (seen.has(t.tactic)) continue;
    seen.add(t.tactic);
    tactics.push({name: TACTIC_NAMES[t.tactic], label: TACTICS[t.tactic].label, evidence: t.evidence, explanation: t.explanation || TACTICS[t.tactic].explain, confidence: t.confidence, stage: null, source: 'model'});
  }
  const prediction = insight.prediction;
  const ruleNext = prediction && prediction.strength !== 'possible' ? {
    action: ACTION_CODES[(prediction.confirmed?.code) || PATTERN_NEXT(prediction)] || 'potential_payment_request',
    label: prediction.confirmed ? prediction.followUp : prediction.predictedAction,
    explanation: prediction.confirmed ? `The request to ${prediction.confirmed.label.toLowerCase()} was already made. ${prediction.uncertainty}` : `${prediction.name}: ${prediction.uncertainty}`,
    confidence: STRENGTH_CONFIDENCE[prediction.strength], confirmed: Boolean(prediction.confirmed), source: 'rules',
  } : null;
  const modelNext = model?.prediction ? {...model.prediction, label: NEXT_ACTIONS[ACTION_ALIASES[model.prediction.action]]?.label || 'Unknown', confirmed: false, source: 'model'} : null;
  const score = Math.max(riskScore(final, insight.findings, insight.requests, prediction), final === insight.level ? insight.score ?? 0 : 0);
  return {
    communication_type: communicationType === 'link' ? 'message' : communicationType,
    risk_level: final,
    risk_score: score,
    risk_score_basis: 'Evidence score from quoted indicators. Not a probability of fraud.',
    detected_tactics: tactics,
    detected_requests: insight.requests.map((r) => ({action: ACTION_CODES[r.code], label: r.label, evidence: r.excerpt, stage: r.turn})),
    predicted_next_action: ruleNext || modelNext,
    recommended_action: recommendedFor(final, prediction),
    explanation: explain(final, tactics, prediction),
    model_explanation: model?.explanation || null,
    analysis_source: source,
    incomplete,
    uncertainty: 'Warnings are estimates based on the words used. They do not prove who is calling or guarantee what happens next.',
  };
}
function PATTERN_NEXT(prediction) {
  return {family: 'payment', romance: 'payment', bank: 'payment', government: 'payment', support: 'remote', delivery: 'link', credentials: 'credentials'}[prediction.pattern] || 'payment';
}

const unitInterval = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const shortText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

// Validates the brief's model JSON. Throws on anything malformed or ungrounded.
export function validateModelReport(value, text) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analysis response.');
  const risk = LEVEL_ALIASES[String(value.risk_level || '').toLowerCase()];
  if (!risk) throw new Error('Invalid risk level.');
  if (value.risk_score != null && !(typeof value.risk_score === 'number' && value.risk_score >= 0 && value.risk_score <= 100)) throw new Error('Invalid risk score.');
  const list = value.detected_tactics ?? [];
  if (!Array.isArray(list) || list.length > 10) throw new Error('Invalid tactics.');
  const tactics = list.map((item) => {
    const tactic = TACTIC_ALIASES[String(item?.name || '').toLowerCase().replace(/[\s-]+/g, '_')];
    if (!tactic || !shortText(item.evidence, 500) || item.evidence.trim().length < 3 || !text.includes(item.evidence)) throw new Error('Ungrounded analysis evidence.');
    if (item.explanation != null && !shortText(item.explanation, 400)) throw new Error('Invalid tactic explanation.');
    if (item.confidence != null && !unitInterval(item.confidence)) throw new Error('Invalid confidence.');
    return {tactic, evidence: item.evidence, explanation: item.explanation?.trim() || null, confidence: item.confidence ?? null};
  });
  if (['caution', 'high'].includes(risk) && !tactics.length) throw new Error('Warning requires evidence.');
  let prediction = null;
  const next = value.predicted_next_action;
  if (next && next.action && next.action !== 'none') {
    const code = ACTION_ALIASES[String(next.action).toLowerCase()];
    if (!code || (next.explanation != null && !shortText(next.explanation, 400)) || (next.confidence != null && !unitInterval(next.confidence))) throw new Error('Invalid prediction.');
    prediction = {action: ACTION_CODES[code], explanation: next.explanation?.trim() || null, confidence: next.confidence ?? null};
  }
  const explanation = shortText(value.explanation, 600) ? value.explanation.trim() : null;
  return {
    risk, riskScore: value.risk_score ?? null, tactics, prediction, explanation,
    reasons: tactics.filter((t) => TACTIC_CATEGORY[t.tactic]).map((t) => ({code: TACTIC_CATEGORY[t.tactic], evidence: t.evidence, title: CATEGORIES[TACTIC_CATEGORY[t.tactic]].label})),
  };
}
