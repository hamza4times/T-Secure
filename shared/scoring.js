import { CATEGORIES } from './schema.js';
export const RUBRIC_VERSION = '1.0.0';
export const CONSENT_VERSION = '1';
export function validateOpportunities(opportunities, conversations) {
  if (!Array.isArray(opportunities) || opportunities.length > 60) throw new Error('Invalid assessment evidence.');
  const seen = new Set();
  return opportunities.filter((item) => {
    const conversation = conversations.find((c) => c.id === item.conversationId);
    const requestIndex = conversation?.turns.findIndex((t) => t.id === item.requestTurnId);
    const responseIndex = conversation?.turns.findIndex((t) => t.id === item.responseTurnId);
    const request = conversation?.turns[requestIndex];
    const response = conversation?.turns[responseIndex];
    if (!request || request.speaker !== 'contact' || !response || response.speaker !== 'user' || responseIndex <= requestIndex || !CATEGORIES[item.category] || !['risky','protective','unclear'].includes(item.classification) || typeof item.evidence !== 'string' || item.evidence.length < 3 || !response.text.includes(item.evidence)) throw new Error('Ungrounded assessment evidence.');
    // One user reply is one assessable response, even if it addresses several tactics.
    const key = item.conversationId + ':' + item.responseTurnId;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(({conversationId,requestTurnId,responseTurnId,category,classification,evidence}) => ({conversationId,requestTurnId,responseTurnId,category,classification,evidence}));
}
export function calculateAssessment(opportunities, metadata = {}) {
  const assessable = opportunities.filter((o) => ['risky', 'protective'].includes(o.classification));
  const risky = assessable.filter((o) => o.classification === 'risky').length;
  const conversations = new Set(assessable.map((o) => o.conversationId)).size;
  const categories = Object.keys(CATEGORIES).map((category) => {
    const items = assessable.filter((o) => o.category === category);
    return {category, assessable: items.length, risky: items.filter((o) => o.classification === 'risky').length};
  }).filter((c) => c.assessable > 0).sort((a,b) => b.risky - a.risky || b.assessable - a.assessable);
  return {
    score: assessable.length >= 5 && conversations >= 3 ? Math.round(100 * risky / assessable.length) : null,
    coverage: {assessable: assessable.length, risky, protective: assessable.length - risky, unclear: opportunities.length - assessable.length, conversations},
    categories, rubricVersion: RUBRIC_VERSION, sample: true, windowDays: 30,
    ...metadata,
  };
}
