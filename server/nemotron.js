// NVIDIA Nemotron through OpenRouter's chat completions API.
import { DEFAULT_MODEL, modelName } from './model-config.js';
import { SYSTEM_PROMPT, parseModelJson, unavailable } from './prompt.js';
export { modelName } from './model-config.js';

export function createModelClient({apiKey,model=DEFAULT_MODEL,fetchImpl=globalThis.fetch,timeoutMs=8000}={}) {
  // meta (optional) receives latency and token usage for benchmarking.
  return async(kind,input,meta={})=>{
    if (!apiKey) throw unavailable('AI analysis is not connected yet. Standard checks remain available.');
    if (kind !== 'communication') throw Object.assign(new Error('Unsupported analysis type.'),{status:400});
    const started=Date.now();
    let response;
    try {
      response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{
        method:'POST',signal:AbortSignal.timeout(timeoutMs),
        headers:{Authorization:'Bearer ' + apiKey,'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({
          model,stream:false,temperature:0,max_tokens:2048,
          // This model supports disabling optional extended thinking. Keep extraction
          // within the interactive deadline and reserve output for grounded evidence.
          reasoning:{enabled:false,exclude:true},
          // This free endpoint does not advertise response_format support.
          // Grounded runtime validation remains mandatory after parsing.
          messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify(input)}],
        }),
      });
    } catch {
      throw unavailable('AI analysis could not connect. Please try again.');
    }
    if (!response.ok) throw unavailable('AI analysis is temporarily unavailable. Please try again.');
    let payload;
    try {payload=await response.json();} catch {throw unavailable('AI returned an incomplete response. Please try again.');}
    const choice=payload?.choices?.[0];
    const content=choice?.message?.content;
    if (payload?.error || choice?.finish_reason==='length' || typeof content !== 'string' || content.length > 30000) throw unavailable('AI returned an incomplete response. Please try again.');
    meta.latencyMs=Date.now()-started;
    meta.usage={input:payload.usage?.prompt_tokens||0,output:payload.usage?.completion_tokens||0,...(typeof payload.usage?.cost==='number'?{cost:payload.usage.cost}:{})};
    try { return parseModelJson(content); }
    catch { throw unavailable('AI returned an incomplete response. Please try again.'); }
  };
}
export async function callNemotron(kind,input,meta) {
  return createModelClient({apiKey:process.env.OPENROUTER_API_KEY,model:modelName})(kind,input,meta);
}
