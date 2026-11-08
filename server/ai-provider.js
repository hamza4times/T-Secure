// Provider abstraction. AI_PROVIDER selects nemotron, gemini, or rules. When unset, the first
// provider with credentials is used, and the rule engine alone runs if none are configured.
// Keys are read only here, on the server.
import { createModelClient } from './nemotron.js';
import { DEFAULT_MODEL } from './model-config.js';
import { createGeminiClient, DEFAULT_GEMINI_MODEL } from './gemini.js';

const env=process.env;
export const PROVIDERS={
  nemotron:{label:'NVIDIA Nemotron via OpenRouter',model:()=>env.OPENROUTER_MODEL||DEFAULT_MODEL,configured:()=>Boolean(env.OPENROUTER_API_KEY),
    client:(model)=>createModelClient({apiKey:env.OPENROUTER_API_KEY,model})},
  gemini:{label:'Google Gemini',model:()=>env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL,configured:()=>Boolean(env.GEMINI_API_KEY),
    client:(model)=>createGeminiClient({apiKey:env.GEMINI_API_KEY,model})},
  rules:{label:'Rule-based baseline',model:()=>'deterministic rules',configured:()=>true,client:()=>null},
};

export function providerStatus() {
  return Object.entries(PROVIDERS).map(([id,p])=>({id,label:p.label,model:p.model(),configured:p.configured()}));
}

// Returns {id,label,model,call}. call is null for the rule engine.
export function resolveProvider(name=env.AI_PROVIDER) {
  const requested=name&&PROVIDERS[name]?name:null;
  const id=requested||['nemotron','gemini'].find((key)=>PROVIDERS[key].configured())||'rules';
  const provider=PROVIDERS[id];
  const model=provider.model();
  return {id,label:provider.label,model,call:provider.client(model)};
}
