import {httpError} from './auth.js';

export function createElevenLabsClient({apiKey,voiceId='JBFqnCBsd6RMkjVDRZzb',model='eleven_flash_v2_5',fetchImpl=globalThis.fetch}={}) {
  async function request(path,body,signal) {
    if(!apiKey)throw httpError(503,'ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the server environment.');
    let response;
    try {
      response=await fetchImpl('https://api.elevenlabs.io/v1/'+path,{
        method:'POST',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),
        headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},
        ...(body?{body:JSON.stringify(body)}:{}),
      });
    }catch(error){if(signal?.aborted)throw error;throw httpError(503,'ElevenLabs could not connect. Please try again.');}
    if(!response.ok)throw httpError(503,'ElevenLabs audio is unavailable. Check the key permissions, credits, and voice configuration.');
    return response;
  }
  return {
    async token(signal) {
      const response=await request('single-use-token/realtime_scribe',undefined,signal);
      let value;try{value=await response.json();}catch{/* Validate below. */}
      if(typeof value?.token!=='string'||!value.token)throw httpError(503,'ElevenLabs could not start transcription.');
      return {token:value.token};
    },
    async speech(text,signal) {
      if(typeof text!=='string'||!text.trim()||text.length>600)throw httpError(400,'Caller speech must contain 1–600 characters.');
      return request('text-to-speech/'+encodeURIComponent(voiceId)+'/stream?output_format=pcm_16000',{
        text,model_id:model,voice_settings:{stability:.45,similarity_boost:.75,speed:1},
      },signal);
    },
  };
}

export function elevenLabs() {
  return createElevenLabsClient({apiKey:process.env.ELEVENLABS_API_KEY,voiceId:process.env.ELEVENLABS_VOICE_ID||undefined,model:process.env.ELEVENLABS_TTS_MODEL||undefined});
}
