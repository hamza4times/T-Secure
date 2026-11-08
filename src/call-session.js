import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import {emotionWarning, unknownEmotion, validateEmotion} from '../shared/emotion.js';
export class CallSession {
  constructor({analyze,onChange,intervalMs=4500,minAnalysisMs=3000}) {
    Object.assign(this,{analyze,onChange,intervalMs,minAnalysisMs});
    this.generation=0; this.snapshot={status:'idle',turns:[],analysis:{risk:'low',reasons:[]}};
  }
  emit() { this.onChange({...this.snapshot,turns:[...this.snapshot.turns]}); }
  startLive(mode='microphone',{callerTrust='unknown'}={}) {
    this.end(false);this.generation++;this.live=true;this.index=0;
    this.snapshot={status:'playing',mode,callerTrust,source:'live-audio',turns:[],analysis:{risk:'unknown',reasons:[],emotion:unknownEmotion()},sequence:0,sessionId:null,alert:null,emotionAlert:null,analyzing:false};
    this.emotionAlertId=null;
    this.announcedRisk=0;this.lastRequest=0;this.lastSequence=0;this.retryAt=0;this.busy=false;this.analysisQueue=[];this.emit();
  }
  ingest(text,speaker='contact') {
    if(!this.live||this.snapshot.status!=='playing'||typeof text!=='string'||!text.trim())return;
    const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text.trim())].map(item=>item.segment.trim());
    for(let i=0;i<sentences.length;i+=2){
      this.snapshot.turns.push({speaker,text:sentences.slice(i,i+2).join(' ').slice(-11000),id:++this.index,timestamp:new Date().toISOString()});
      this.snapshot.sequence++;
      // A bounded rolling context keeps long audio sessions within the API limit.
      while(this.snapshot.turns.length>1&&(this.context().length>11500||this.snapshot.turns.length>120||this.analysisBytes()>55000))this.snapshot.turns.shift();
      while(this.analysisBytes()>55000){const turn=this.snapshot.turns[0];turn.text=turn.text.slice(Math.ceil(turn.text.length/2));}
      if(speaker==='user')this.snapshot.analysis.emotion=unknownEmotion();
      this.snapshot.analysis={...mergeAnalysis(this.snapshot.analysis,analyzeText(this.context())),incomplete:this.snapshot.analysis.incomplete};
      this.analysisQueue.push({sequence:this.snapshot.sequence,text:this.context(),turns:this.analysisTurns()});
      this.checkAlert();this.emit();this.request();
    }
  }
  context() {return this.snapshot.turns.map(turn=>turn.speaker+': '+turn.text).join('\n');}
  analysisTurns() {return this.snapshot.turns.map(({id,speaker,text})=>({id:String(id),speaker,text}));}
  analysisBytes() {return new TextEncoder().encode(JSON.stringify({text:this.context(),turns:this.analysisTurns()})).length;}
  start(scenario) {
    this.end(false); this.generation++; this.live=false;this.scenario=scenario; this.index=0;
    this.snapshot={status:'playing',scenarioId:scenario.id,callerTrust:scenario.callerTrust||'unknown',turns:[],analysis:{risk:'low',reasons:[],emotion:unknownEmotion()},sequence:0,sessionId:null,alert:null,emotionAlert:null};
    this.emotionAlertId=null;
    this.announcedRisk=0;
    this.lastRequest=0; this.retryAt=0;this.busy=false; this.advance(); this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    if (!this.live&&this.snapshot.status === 'playing') this.timer=setTimeout(()=>{this.advance();this.schedule();},this.intervalMs);
  }
  advance() {
    if (this.index >= this.scenario.turns.length) {this.snapshot.status='completed';this.emit();return;}
    const [speaker,text]=this.scenario.turns[this.index++];
    this.snapshot.turns.push({speaker,text,id:this.index,timestamp:new Date().toISOString()});
    this.snapshot.sequence++;
    if(speaker==='user')this.snapshot.analysis.emotion=unknownEmotion();
    const context=this.snapshot.turns.map((turn)=>turn.speaker + ': ' + turn.text).join('\n');
    this.snapshot.analysis={...mergeAnalysis(this.snapshot.analysis,analyzeText(context)),incomplete:this.snapshot.analysis.incomplete};
    this.checkAlert();
    this.emit(); this.request();
  }
  checkAlert() {
    if(!['playing','paused'].includes(this.snapshot.status))return;
    this.snapshot.analysis.emotion=validateEmotion(this.snapshot.analysis.emotion,this.snapshot.turns);
    const {risk,reasons}=this.snapshot.analysis;
    const level={caution:1,high:2}[risk]||0;
    const context=this.snapshot.turns.map(turn=>turn.speaker+': '+turn.text).join('\n');
    const grounded=reasons.some(reason=>typeof reason.evidence==='string'&&reason.evidence.length>=3&&context.includes(reason.evidence));
    const warning=emotionWarning({...this.snapshot.analysis,reasons:grounded?reasons:[]},this.snapshot.callerTrust);
    if(warning){
      this.emotionAlertId ||= this.generation+':emotion';
      this.snapshot.emotionAlert={id:this.emotionAlertId,emotion:this.snapshot.analysis.emotion.label};
    }else this.snapshot.emotionAlert=null;
    if(level<=this.announcedRisk||!grounded)return;
    this.announcedRisk=level;
    this.snapshot.alert={id:this.generation+':'+level,risk};
    // A single deliberate interruption for high risk; reviewing it never resets
    // the warning or enables repeated interruptions from the same call.
    if(risk==='high'){
      this.snapshot.status='paused';
      clearTimeout(this.timer);
    }
  }
  async request() {
    if (this.busy || !['playing','paused','completed'].includes(this.snapshot.status)) return;
    if(this.live&&!this.analysisQueue.length)return;
    if(Date.now()<this.retryAt)return;
    const delay=this.minAnalysisMs - (Date.now()-this.lastRequest);
    if (delay>0) {clearTimeout(this.pending);this.pending=setTimeout(()=>this.request(),delay);return;}
    this.busy=true;this.lastRequest=Date.now();this.lastSequence=this.snapshot.sequence;
    const queued=this.live?this.analysisQueue.shift():null;
    const generation=this.generation, sequence=queued?.sequence||this.snapshot.sequence;
    this.snapshot.analyzing=true;this.emit();
    this.controller=new AbortController();
    try {
      const result=await this.analyze({
        channel:'call',source:this.snapshot.source||'simulation',sessionId:this.snapshot.sessionId,sequence,
        text:queued?.text||this.context(),turns:queued?.turns||this.analysisTurns(),callerTrust:this.snapshot.callerTrust,
      },this.controller.signal);
      if (generation !== this.generation) return;
      this.snapshot.sessionId=result.sessionId || this.snapshot.sessionId;
      if (this.live||sequence === this.snapshot.sequence) {
        const previous=this.live&&this.snapshot.analysis.risk==='unknown'&&!result.incomplete?{...this.snapshot.analysis,risk:'low'}:this.snapshot.analysis;
        this.snapshot.analysis=mergeAnalysis(previous,{...result,emotion:validateEmotion(result.emotion,this.snapshot.turns)});
        this.snapshot.analysis.incomplete=result.incomplete;
        this.snapshot.analysisError=result.incomplete?'Nemotron could not complete this check. Independent rule checks remain active.':null;
        this.checkAlert();
        this.emit();
      }
    } catch (error) {
      if (generation === this.generation && error.name !== 'AbortError') {
        if([401,403].includes(error.status))this.retryAt=Infinity;
        else this.retryAt=Date.now()+Math.max(this.minAnalysisMs,error.retryAfterMs||30000);
        this.snapshot.analysis.incomplete=true;
        this.snapshot.analysis.emotion=unknownEmotion();this.snapshot.emotionAlert=null;
        this.snapshot.analysisError=error.message;
        if (this.snapshot.analysis.risk==='low') this.snapshot.analysis.risk='unknown';
        this.emit();
      }
    } finally {
      if (generation === this.generation) {
        this.busy=false;
        this.snapshot.analyzing=false;this.emit();
        if (sequence < this.snapshot.sequence) this.request();
      }
    }
  }
  pause() {if(this.snapshot.status==='playing'){this.snapshot.status='paused';clearTimeout(this.timer);this.emit();}}
  resume() {if(this.snapshot.status==='paused'){this.snapshot.status='playing';this.emit();this.schedule();}}
  end(notify=true) {
    this.generation++;clearTimeout(this.timer);clearTimeout(this.pending);this.controller?.abort();
    this.snapshot={...this.snapshot,status:'ended'};this.busy=false;
    if(notify)this.emit();
  }
}
