// Optional synthetic voices for the simulated call, using the browser's own text-to-speech.
// Every line is a scripted, fictional transcript. No real person's voice is recorded or cloned.
export class CallVoice {
  constructor({scope=globalThis}={}) {this.scope=scope;this.enabled=false;}
  get available() {return Boolean(this.scope.speechSynthesis&&this.scope.SpeechSynthesisUtterance);}
  speak(turn) {
    if(!this.enabled||!this.available||!turn?.text)return;
    const synth=this.scope.speechSynthesis;
    synth.cancel();
    const utterance=new this.scope.SpeechSynthesisUtterance(turn.text);
    const voices=synth.getVoices().filter((voice)=>voice.lang?.startsWith('en'));
    // Distinct voices make it easy to follow who is speaking.
    if(voices.length>1)utterance.voice=voices[turn.speaker==='contact'?0:1];
    utterance.lang='en-US';
    utterance.rate=turn.speaker==='contact'?1.02:.95;
    utterance.pitch=turn.speaker==='contact'?.85:1.15;
    synth.speak(utterance);
  }
  stop() {if(this.available)this.scope.speechSynthesis.cancel();}
}
