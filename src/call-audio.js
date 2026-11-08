import {supportiveGuidance} from '../shared/emotion.js';
const GUIDANCE={
  caution:'Take a moment. Pause and verify the caller before acting.',
  high:'Possible scam. Pause and verify the caller using a number you already trust.',
};
export class CallAudio {
  constructor({scope=globalThis,onUnavailable=()=>{}}={}) {
    this.scope=scope;this.onUnavailable=onUnavailable;this.mode='visual';this.nodes=new Set();this.generation=0;
  }
  async setMode(mode) {
    this.stop();
    this.mode=['visual','tone','speech'].includes(mode)?mode:'visual';
    return this.prepare();
  }
  async prepare() {
    try {
      if(this.mode==='speech') {
        if(!this.scope.speechSynthesis||!this.scope.SpeechSynthesisUtterance)throw new Error('Unavailable');
      }
      if(this.mode==='tone'){
        const Context=this.scope.AudioContext||this.scope.webkitAudioContext;
        if(!Context)throw new Error('Unavailable');
        this.context ||= new Context();
        if(this.context.state==='suspended')await this.context.resume();
      }
      return true;
    }catch{this.onUnavailable();return false;}
  }
  async play(risk,emotion) {
    const guidance=risk==='emotion'?supportiveGuidance(emotion):GUIDANCE[risk];
    if(this.mode==='visual'||!guidance)return;
    this.stop();
    const generation=this.generation;
    if(!await this.prepare())return;
    if(generation!==this.generation)return;
    try {
      if(this.mode==='speech'){
        const utterance=new this.scope.SpeechSynthesisUtterance(guidance);
        utterance.lang='en-US';utterance.rate=.9;utterance.volume=.55;
        utterance.onend=()=>{if(generation===this.generation)this.speaking=false;};
        utterance.onerror=()=>{if(generation===this.generation){this.speaking=false;this.onUnavailable();}};
        this.speaking=true;
        this.scope.speechSynthesis.speak(utterance);
      }else{
        const context=this.context,now=context.currentTime;
        const oscillator=context.createOscillator(),gain=context.createGain();
        const duration=risk==='high'?.42:.24;
        oscillator.type='sine';
        oscillator.frequency.setValueAtTime(risk==='high'?520:440,now);
        if(risk==='high')oscillator.frequency.setValueAtTime(440,now+.2);
        gain.gain.setValueAtTime(0,now);
        gain.gain.linearRampToValueAtTime(.06,now+.025);
        gain.gain.linearRampToValueAtTime(0,now+duration);
        oscillator.connect(gain);gain.connect(context.destination);
        this.nodes.add(oscillator);
        oscillator.onended=()=>{this.nodes.delete(oscillator);oscillator.disconnect();gain.disconnect();};
        oscillator.start(now);oscillator.stop(now+duration);
      }
    }catch{this.onUnavailable();}
  }
  stop() {
    this.generation++;
    if(this.speaking){this.speaking=false;this.scope.speechSynthesis?.cancel();}
    for(const oscillator of this.nodes){try{oscillator.stop();}catch{/* Already ended. */}}
    this.nodes.clear();
  }
}
