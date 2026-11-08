// Render silence to the output so microphone input is never echoed to speakers.
// Each 100 ms of actual input becomes signed, little-endian 16 kHz PCM.
class PcmCapture extends AudioWorkletProcessor {
  constructor(){super();this.samples=new Int16Array(1600);this.silence=new Float32Array(128);this.offset=0;}
  process(inputs){
    const input=inputs[0]?.[0]||this.silence;
    if(input)for(const sample of input){
      this.samples[this.offset++]=Math.max(-1,Math.min(1,sample))*(sample<0?32768:32767);
      if(this.offset===this.samples.length){this.port.postMessage(this.samples.buffer,[this.samples.buffer]);this.samples=new Int16Array(1600);this.offset=0;}
    }
    return true;
  }
}
registerProcessor('pcm-capture',PcmCapture);
