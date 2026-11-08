import { randomUUID } from 'node:crypto';
import { httpError } from './auth.js';
import { parseCommunication, validateModelAnalysis } from '../shared/schema.js';
import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import { calculateAssessment, validateOpportunities, CONSENT_VERSION } from '../shared/scoring.js';
import { getHistory, historySets } from '../shared/fixtures.js';
import { extractIndicators, indicatorsToStore } from '../shared/network.js';
import { analyzeConversation, combineRisk, maxLevel, turnsFromText } from '../shared/prediction.js';
import { modelName as configuredModel } from './model-config.js';

export function createService({store, model, modelName = configuredModel}) {
  return {
    async analyze(uid, body) {
      let input;
      try { input=parseCommunication(body); } catch(error) { throw httpError(400,error.message); }
      let previous;
      if (input.sessionId) {
        previous = await store.getIncident(uid, input.sessionId);
        if (!previous) throw httpError(404, 'This session is unavailable.');
        if (input.sequence <= previous.sequence) throw httpError(409, 'A newer analysis is already available.');
      }
      const sessionId = input.sessionId || randomUUID();
      let result = analyzeText(input.text);
      const deterministic = maxLevel(result.risk, analyzeConversation(turnsFromText(input.text)).level);
      result.risk = deterministic;
      let incomplete = false;
      try {
        const ai = validateModelAnalysis(await model('communication', {text:input.text,channel:input.channel}), input.text);
        result = mergeAnalysis(result, {...ai, analysisSource:'hybrid'});
        result.risk = combineRisk(deterministic, ai.risk);
      } catch { incomplete = true; if (result.risk === 'low') result.risk = 'unknown'; }
      if (previous?.risk) result = mergeAnalysis(result, {risk:previous.risk,reasons:[]});
      // Persist only codes and derived state, never raw text, excerpts, or model prose.
      // Network indicators are derived (domains, sender, codes, hashed wording) and kept only for warnings.
      const indicators = indicatorsToStore(extractIndicators({text:input.text,sender:input.sender}), result.risk);
      // A failed history write must not hide a completed safety check from the customer.
      let saved = true;
      try { await store.saveIncident(uid, sessionId, {
        ...(indicators ? {indicators} : {}),
        channel:input.channel, source:input.source, sequence:input.sequence, risk:result.risk,
        reasonCodes:[...new Set(result.reasons.map((r) => r.code))],
        createdAt:previous?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString(),
        recovery:previous?.recovery || [],
      }); } catch { saved = false; }
      // Without a saved record, a follow-up turn must start a new session rather than reference a missing one.
      return {...result,sessionId:saved ? sessionId : input.sessionId,sequence:input.sequence,incomplete,saved};
    },
    async setConsent(uid, body) {
      if (typeof body?.enabled !== 'boolean' || !historySets.some((h) => h.id === body.historySetId)) throw httpError(400,'Choose a sample history and consent preference.');
      return store.setConsent(uid,body.enabled,body.historySetId,CONSENT_VERSION);
    },
    async assess(uid, body) {
      let history;
      try { history=getHistory(body?.historySetId); } catch { throw httpError(400,'Choose an available sample conversation history.'); }
      const consent = await store.getConsent(uid);
      if (!consent?.enabled) throw httpError(403, 'Enable advanced analysis before analyzing sample conversations.');
      if (consent.historySetId !== history.id) throw httpError(409, 'Your sample selection changed. Please try again.');
      const extracted = await model('profile', {conversations:history.conversations});
      const opportunities = validateOpportunities(extracted?.opportunities, history.conversations);
      const assessment = calculateAssessment(opportunities, {
        historySetId:history.id, generatedAt:new Date().toISOString(), windowStart:history.windowStart,
        windowEnd:history.windowEnd, modelVersion:modelName, analysisSource:'hybrid',
      });
      if (!await store.commitAssessment(uid, consent.revision, assessment)) throw httpError(409, 'Analysis was cancelled because your preferences changed.');
      return assessment;
    },
    async profile(uid) {
      const consent = await store.getConsent(uid);
      return {consent,assessment:consent?.enabled ? await store.getAssessment(uid) : null};
    },
    async deleteAssessment(uid) { await store.clearAssessment(uid); return {assessment:null}; },
  };
}
