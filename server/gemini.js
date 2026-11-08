// Google Gemini through the Generative Language API (generateContent).
import { SYSTEM_PROMPT, parseModelJson, unavailable } from './prompt.js';

// Configurable because Gemini model names change; set GEMINI_MODEL to a current model.
export const DEFAULT_GEMINI_MODEL='gemini-2.5-flash';

export function createGeminiClient({apiKey,model=DEFAULT_GEMINI_MODEL,fetchImpl=globalThis.fetch,timeoutMs=12000}={}) {
  return async(kind,input,meta={})=>{
    if (!apiKey) throw unavailable('Gemini is not connected yet. Standard checks remain available.');
    if (kind !== 'communication') throw Object.assign(new Error('Unsupported analysis type.'),{status:400});
    const started=Date.now();
    let response;
    try {
      response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
        method:'POST',signal:AbortSignal.timeout(timeoutMs),
        // The key travels in a header, never in the URL, so it cannot reach request logs.
        headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
          contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],
          // Thinking models count reasoning against this budget, so leave headroom.
          generationConfig:{temperature:0,maxOutputTokens:4096,responseMimeType:'application/json'},
        }),
      });
    } catch {
      throw unavailable('Gemini could not connect. Please try again.');
    }
    if (!response.ok) throw unavailable('Gemini is temporarily unavailable. Please try again.');
    let payload;
    try {payload=await response.json();} catch {throw unavailable('Gemini returned an incomplete response. Please try again.');}
    const candidate=payload?.candidates?.[0];
    const content=(candidate?.content?.parts||[]).filter((part)=>!part.thought&&typeof part.text==='string').map((part)=>part.text).join('');
    if (payload?.error || !candidate || (candidate.finishReason && candidate.finishReason!=='STOP') || !content || content.length > 30000) throw unavailable('Gemini returned an incomplete response. Please try again.');
    meta.latencyMs=Date.now()-started;
    meta.usage={input:payload.usageMetadata?.promptTokenCount||0,output:(payload.usageMetadata?.candidatesTokenCount||0)+(payload.usageMetadata?.thoughtsTokenCount||0)};
    try { return parseModelJson(content); }
    catch { throw unavailable('Gemini returned an incomplete response. Please try again.'); }
  };
}
