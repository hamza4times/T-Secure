const aborted=()=>new DOMException('Audio stopped.','AbortError');

// Only short-lived, single-use tokens cross the browser boundary.
export class ScribeStream {
  constructor({token,onTranscript,onPartial=()=>{},onError,WebSocketImpl=globalThis.WebSocket}) {
    Object.assign(this,{token,onTranscript,onPartial,onError,WebSocketImpl});
  }
  start() {
    this.active=true;this.audioSamples=0;this.commitRequested=false;this.awaitingCommit=false;
    const query=new URLSearchParams({token:this.token,model_id:'scribe_v2_realtime',audio_format:'pcm_16000',language_code:'en',commit_strategy:'vad',vad_silence_threshold_secs:'0.7'});
    this.socket=new this.WebSocketImpl('wss://api.elevenlabs.io/v1/speech-to-text/realtime?'+query);
    return new Promise((resolve,reject)=>{
      this.rejectStart=reject;
      this.timeout=setTimeout(()=>this.fail(new Error('Transcription timed out. Please start the audio again.')),15000);
      this.socket.onmessage=event=>{
        if(!this.active)return;
        let message;try{message=JSON.parse(event.data);}catch{return;}
        if(message.message_type==='session_started'){clearTimeout(this.timeout);this.ready=true;this.rejectStart=null;resolve();}
        else if(message.message_type==='partial_transcript'){
          this.onPartial(message.text||'');
          if(!this.awaitingCommit&&(message.text?.match(/[.!?]+(?:\s|$)/g)||[]).length>=2)this.commitRequested=true;
        }
        else if(message.message_type==='committed_transcript'){
          this.audioSamples=0;this.commitRequested=false;this.awaitingCommit=false;
          if(typeof message.text==='string'&&message.text.trim())this.onTranscript(message.text.trim());
        }
        else if(message.error||/_error$|^error$|quota_exceeded|rate_limited/.test(message.message_type||''))this.fail(new Error('Live transcription is unavailable. Check ElevenLabs access and credits, then start again.'));
      };
      this.socket.onerror=()=>this.fail(new Error('Live transcription could not connect. Check your connection and start again.'));
      this.socket.onclose=()=>{if(this.active)this.fail(new Error('Live transcription disconnected. Please start the audio again.'));};
    });
  }
  send(bytes) {
    if(!this.active||!this.ready||this.socket.readyState!==1)return;
    if(this.socket.bufferedAmount>512000){this.fail(new Error('Audio cannot upload fast enough. Check your connection and start again.'));return;}
    let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    this.audioSamples+=bytes.length/2;
    const commit=this.commitRequested&&!this.awaitingCommit&&this.audioSamples>=32000;
    if(commit){this.awaitingCommit=true;this.commitRequested=false;}
    this.socket.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:btoa(binary),sample_rate:16000,...(commit?{commit:true}:{})}));
  }
  fail(error) {if(!this.active)return;const pending=this.rejectStart;this.rejectStart=null;this.stop();pending?.(error);this.onError(error);}
  stop() {this.active=false;this.ready=false;clearTimeout(this.timeout);this.rejectStart?.(aborted());this.rejectStart=null;this.socket?.close();}
}

export class LiveAudio {
  constructor({request,onTranscript,onPartial=()=>{},onStatus=()=>{},onError}) {
    Object.assign(this,{request,onTranscript,onPartial,onStatus,onError});this.generation=0;this.nodes=new Set();
  }
  async start(mode='practice') {
    this.stop();const generation=this.generation;this.mode=mode;this.paused=false;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioWorkletNode)throw new Error('Live audio needs a microphone-capable browser on HTTPS or localhost.');
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
    const context=new Context({sampleRate:16000});this.context=context;this.controller=new AbortController();
    // Resume from the start button's gesture before waiting for any network work.
    await context.resume();this.onStatus('Requesting microphone access…');
    try{
      const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
      if(generation!==this.generation){media.getTracks().forEach(track=>track.stop());throw aborted();}
      this.media=media;media.getAudioTracks().forEach(track=>{track.onended=()=>this.fail(new Error('Microphone disconnected. Reconnect it and start again.'));});
      await context.audioWorklet.addModule('/pcm-capture.js');
      if(generation!==this.generation)throw aborted();
      this.onStatus('Connecting live transcription…');
      const open=async speaker=>{
        const {token}=await this.request({action:'token'},this.controller.signal);
        if(generation!==this.generation)throw aborted();
        const stream=new ScribeStream({token,onTranscript:text=>{if(!this.paused&&generation===this.generation)this.onTranscript(text,speaker);},onPartial:text=>{if(!this.paused)this.onPartial(text,speaker);},onError:error=>this.fail(error)});
        this.streams.push(stream);await stream.start();return stream;
      };
      this.streams=[];
      const microphone=await open(mode==='practice'?'user':'contact');
      const tap=stream=>{
        const node=new AudioWorkletNode(context,'pcm-capture');
        node.port.onmessage=event=>{if(!this.paused)stream.send(new Uint8Array(event.data));};
        node.connect(context.destination);return node;
      };
      this.micTap=tap(microphone);this.micGain=context.createGain();
      this.micSource=context.createMediaStreamSource(media);this.micSource.connect(this.micGain);this.micGain.connect(this.micTap);
      if(mode==='practice')this.callerTap=tap(await open('contact'));
      if(generation!==this.generation)throw aborted();
      this.onStatus(mode==='practice'?'Connected · AI caller preparing…':'Listening · Speak near your microphone');
    }catch(error){if(generation===this.generation)this.stop();if(error.name==='NotAllowedError')throw new Error('Microphone permission was denied. Allow microphone access in your browser, then start again.');throw error;}
  }
  async speak(text) {
    const generation=this.generation,context=this.context;
    if(!context||!this.callerTap)throw new Error('Start the audio connection first.');
    clearTimeout(this.unmute);this.micGain.gain.value=0;this.onStatus('AI caller speaking · Listening for warning signs');
    const response=await this.request({action:'speech',text},this.controller.signal,true);
    const reader=response.body.getReader();let remainder=new Uint8Array(),next=context.currentTime+.08,lastEnd=Promise.resolve();
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        if(generation!==this.generation)throw aborted();
        const joined=new Uint8Array(remainder.length+value.length);joined.set(remainder);joined.set(value,remainder.length);
        const length=joined.length-(joined.length%2);remainder=joined.slice(length);
        if(!length)continue;
        const samples=new DataView(joined.buffer,0,length),buffer=context.createBuffer(1,length/2,16000),channel=buffer.getChannelData(0);
        for(let i=0;i<channel.length;i++)channel[i]=samples.getInt16(i*2,true)/32768;
        const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);node.connect(this.callerTap);this.nodes.add(node);
        lastEnd=new Promise(resolve=>{node.onended=()=>{this.nodes.delete(node);node.disconnect();resolve();};});
        const starts=Math.max(next,context.currentTime+.02);node.start(starts);next=starts+buffer.duration;
      }
      if(remainder.length)throw new Error('Caller audio was incomplete. Start again.');
      await lastEnd;
      if(generation!==this.generation)return;
      // Let the caller transcript commit before capturing the learner's reply.
      this.unmute=setTimeout(()=>{if(generation===this.generation){this.micGain.gain.value=1;this.onStatus('Your turn · Reply aloud');}},800);
    }finally{reader.releaseLock();}
  }
  setPaused(paused) {
    this.paused=paused;
    if(this.media)this.media.getAudioTracks().forEach(track=>{track.enabled=!paused;});
    if(this.context){const operation=paused?this.context.suspend():this.context.resume();operation.catch(()=>{});}
  }
  fail(error) {if(!this.context)return;this.stop();this.onError(error);}
  stop() {
    this.generation++;clearTimeout(this.unmute);this.controller?.abort();
    this.streams?.forEach(stream=>stream.stop());this.streams=[];
    this.media?.getTracks().forEach(track=>{track.onended=null;track.stop();});this.media=null;
    for(const node of this.nodes){try{node.stop();}catch{/* Already ended. */}}this.nodes.clear();
    this.micSource?.disconnect();this.micGain?.disconnect();this.micTap?.disconnect();this.callerTap?.disconnect();
    this.context?.close().catch(()=>{});this.context=null;
  }
}
