import { randomUUID } from 'node:crypto';
import { httpError } from './auth.js';
import { parseCommunication } from '../shared/schema.js';
import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import { extractIndicators, indicatorsToStore } from '../shared/network.js';
import { analyzeConversation, combineRisk, maxLevel, turnsFromText, contactText } from '../shared/prediction.js';
import { buildReport, validateModelReport, ACTION_CODES } from '../shared/report.js';
import { EVALUATION_SCENARIOS, runRules, scoreResult, summarize } from '../shared/evaluation.js';
import { modelName as configuredModel } from './model-config.js';

// Model evidence must quote the other party, never the customer's own replies.
export const groundingText = contactText;
const ACTION_KEYS = Object.fromEntries(Object.entries(ACTION_CODES).map(([key, code]) => [code, key]));

// provider: {id,label,model,call(kind,input,meta)|null}. `model`/`modelName` remain for tests and older callers.
export function createService({store, provider, model, modelName = configuredModel, resolve}) {
  const ai = provider || (model ? {id: 'nemotron', label: 'NVIDIA Nemotron via OpenRouter', model: modelName, call: model} : {id: 'rules', label: 'Rule-based baseline', model: 'deterministic rules', call: null});
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
      const insight = analyzeConversation(turnsFromText(input.text));
      let result = analyzeText(contactText(input.text));
      const deterministic = maxLevel(result.risk, insight.level);
      result.risk = deterministic;
      let incomplete = false, modelReport = null;
      if (ai.call) {
        try {
          modelReport = validateModelReport(await ai.call('communication', {communication_type: input.channel === 'call' ? 'call' : 'message', text: input.text}), groundingText(input.text));
          result = mergeAnalysis(result, {risk: modelReport.risk, reasons: modelReport.reasons, analysisSource: 'hybrid'});
          // A model can raise the deterministic rating by one level at most, and never lower it.
          result.risk = combineRisk(deterministic, modelReport.risk);
        } catch { incomplete = true; if (result.risk === 'low') result.risk = 'unknown'; }
      }
      if (previous?.risk) result = mergeAnalysis(result, {risk:previous.risk,reasons:[]});
      const report = buildReport({communicationType: input.channel, level: result.risk, insight, model: modelReport, source: modelReport ? ai.id : 'rules', incomplete});
      // Persist only codes and derived state, never raw text, excerpts, or model prose.
      // Network indicators are derived (domains, sender, codes, hashed wording) and kept only for warnings.
      const indicators = indicatorsToStore(extractIndicators({text:input.text,sender:input.sender}), result.risk);
      // A failed history write must not hide a completed safety check from the customer.
      let saved = true;
      try { await store.saveIncident(uid, sessionId, {
        ...(indicators ? {indicators} : {}),
        channel:input.channel, source:input.source, sequence:input.sequence, risk:result.risk, riskScore:report.risk_score,
        reasonCodes:[...new Set(result.reasons.map((r) => r.code))],
        tactics:[...new Set(insight.findings.map((f) => f.tactic).concat((modelReport?.tactics || []).map((t) => t.tactic)))],
        predictedAction:report.predicted_next_action?.action || null, analysisSource:report.analysis_source,
        createdAt:previous?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString(),
        recovery:previous?.recovery || [],
      }); } catch { saved = false; }
      // Without a saved record, a follow-up turn must start a new session rather than reference a missing one.
      return {...result,report,provider:{id:ai.id,label:ai.label,model:ai.model},sessionId:saved ? sessionId : input.sessionId,sequence:input.sequence,incomplete,saved};
    },
    // Runs the fixed evaluation scenarios through one engine and stores what actually happened.
    async benchmark(body) {
      const target = resolve ? resolve(body?.provider) : ai;
      if (body?.provider && target.id !== body.provider) throw httpError(400, 'Choose an available provider.');
      const ids = Array.isArray(body?.scenarioIds) ? body.scenarioIds : null;
      const scenarios = EVALUATION_SCENARIOS.filter((s) => !ids || ids.includes(s.id));
      if (!scenarios.length) throw httpError(400, 'Choose at least one scenario.');
      const runs = [];
      const queue = [...scenarios];
      const worker = async () => {
        for (let scenario = queue.shift(); scenario; scenario = queue.shift()) runs.push(await runScenario(target, scenario));
      };
      // Small concurrency keeps free-tier providers within their rate limits.
      await Promise.all(Array.from({length: Math.min(3, scenarios.length)}, worker));
      runs.sort((a, b) => scenarios.findIndex((s) => s.id === a.scenarioId) - scenarios.findIndex((s) => s.id === b.scenarioId));
      const evaluation = {provider: {id: target.id, label: target.label, model: target.model}, ranAt: new Date().toISOString(), runs, summary: summarize(runs)};
      try { await store.saveEvaluation?.(evaluation); evaluation.saved = Boolean(store.saveEvaluation); } catch { evaluation.saved = false; }
      return evaluation;
    },
  };
}

async function runScenario(provider, scenario) {
  const started = performance.now();
  const base = {scenarioId: scenario.id, result: null, score: null, error: null, latencyMs: null, usage: null};
  if (!provider.call) {
    const result = runRules(scenario.text, scenario.type);
    return {...base, result, score: scoreResult(scenario.expected, result), latencyMs: Math.round((performance.now() - started) * 10) / 10};
  }
  const meta = {};
  try {
    const raw = await provider.call('communication', {communication_type: scenario.type === 'sms' ? 'message' : 'call', text: scenario.text}, meta);
    const report = validateModelReport(raw, groundingText(scenario.text));
    const result = {risk: report.risk, tactics: [...new Set(report.tactics.map((t) => t.tactic))], next: report.prediction ? ACTION_KEYS[report.prediction.action] : null, explanation: report.explanation};
    return {...base, result, score: scoreResult(scenario.expected, result), latencyMs: meta.latencyMs ?? Math.round(performance.now() - started), usage: meta.usage || null};
  } catch (error) {
    return {...base, error: error.status ? 'Provider unavailable or incomplete response' : 'Output failed validation (' + error.message.replace(/\.$/, '').toLowerCase() + ')', latencyMs: meta.latencyMs ?? Math.round(performance.now() - started), usage: meta.usage || null};
  }
}
