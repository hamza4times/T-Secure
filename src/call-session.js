import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import { analyzeConversation, contactText } from '../shared/prediction.js';
export class CallSession {
  constructor({analyze,onChange,intervalMs=4500,minAnalysisMs=3000}) {
    Object.assign(this,{analyze,onChange,intervalMs,minAnalysisMs});
    this.generation=0; this.snapshot={status:'idle',turns:[],analysis:{risk:'low',reasons:[]}};
  }
  emit() { this.onChange({...this.snapshot,turns:[...this.snapshot.turns]}); }
  // Call duration counts only time spent playing, so pauses and warnings do not inflate it.
  elapsedMs() { return (this.clock?.total||0)+(this.snapshot.status==='playing'&&this.clock?.since?Date.now()-this.clock.since:0); }
  stopClock() { if(this.clock?.since){this.clock.total+=Date.now()-this.clock.since;this.clock.since=null;} }
  start(scenario) {
    this.end(false); this.generation++; this.scenario=scenario; this.index=0; this.clock={total:0,since:Date.now()};
    this.snapshot={status:'playing',scenarioId:scenario.id,turns:[],analysis:{risk:'low',reasons:[]},insight:analyzeConversation([]),predictedAt:null,sequence:0,sessionId:null,alert:null};
    this.announcedRisk=0;
    this.lastRequest=0; this.retryAt=0;this.busy=false; this.advance(); this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    if (this.snapshot.status === 'playing') this.timer=setTimeout(()=>{this.advance();this.schedule();},this.intervalMs);
  }
  advance() {
    if (this.index >= this.scenario.turns.length) {this.stopClock();this.snapshot.status='completed';this.emit();return;}
    const [speaker,text]=this.scenario.turns[this.index++];
    this.snapshot.turns.push({speaker,text,id:this.index,timestamp:new Date().toISOString()});
    this.snapshot.sequence++;
    const context=this.snapshot.turns.map((turn)=>turn.speaker + ': ' + turn.text).join('\n');
    this.snapshot.analysis={...mergeAnalysis(this.snapshot.analysis,analyzeText(contactText(context))),incomplete:this.snapshot.analysis.incomplete};
    this.updateInsight();
    this.checkAlert();
    this.emit(); this.request();
  }
  updateInsight() {
    const insight=analyzeConversation(this.snapshot.turns);
    // Remember when a likely next step was first predicted, so the timeline can
    // show how early the warning came compared with the actual request.
    if(insight.prediction&&insight.prediction.strength!=='possible'&&!this.snapshot.predictedAt)this.snapshot.predictedAt={turn:this.snapshot.turns.length,action:insight.prediction.predictedAction};
    this.snapshot.insight=insight;
  }
  checkAlert() {
    if(!['playing','paused'].includes(this.snapshot.status))return;
    const {risk,reasons}=this.snapshot.analysis;
    const insight=this.snapshot.insight;
    const context=this.snapshot.turns.map(turn=>turn.speaker+': '+turn.text).join('\n');
    const grounded=reasons.some(reason=>typeof reason.evidence==='string'&&reason.evidence.length>=3&&context.includes(reason.evidence));
    const ruleLevel=grounded?({caution:1,high:2}[risk]||0):0;
    // Prediction findings are exact transcript excerpts, so they are grounded by construction.
    const insightLevel=insight&&(insight.findings.length||insight.requests.length)?({caution:1,high:2}[insight.level]||0):0;
    const level=Math.max(ruleLevel,insightLevel);
    if(level<=this.announcedRisk)return;
    this.announcedRisk=level;
    const alertRisk=level===2?'high':'caution';
    this.snapshot.alert={id:this.generation+':'+level,risk:alertRisk,predictive:ruleLevel<level};
    // A single deliberate interruption for high risk; reviewing it never resets
    // the warning or enables repeated interruptions from the same call.
    if(alertRisk==='high'){
      this.stopClock();
      this.snapshot.status='paused';
      clearTimeout(this.timer);
    }
  }
  async request() {
    if (this.busy || !['playing','paused','completed'].includes(this.snapshot.status)) return;
    if(Date.now()<this.retryAt)return;
    const delay=this.minAnalysisMs - (Date.now()-this.lastRequest);
    if (delay>0) {clearTimeout(this.pending);this.pending=setTimeout(()=>this.request(),delay);return;}
    this.busy=true;this.lastRequest=Date.now();
    const generation=this.generation, sequence=this.snapshot.sequence;
    this.controller=new AbortController();
    try {
      const result=await this.analyze({
        channel:'call',source:'simulation',sessionId:this.snapshot.sessionId,sequence,sender:this.scenario.number,
        text:this.snapshot.turns.map((t)=>t.speaker + ': ' + t.text).join('\n'),
      },this.controller.signal);
      if (generation !== this.generation) return;
      this.snapshot.sessionId=result.sessionId || this.snapshot.sessionId;
      if (sequence === this.snapshot.sequence) {
        this.snapshot.analysis=mergeAnalysis(this.snapshot.analysis,result);
        this.snapshot.analysis.incomplete=result.incomplete;
        this.checkAlert();
        this.emit();
      }
    } catch (error) {
      if (generation === this.generation && error.name !== 'AbortError') {
        if([401,403].includes(error.status))this.retryAt=Infinity;
        else this.retryAt=Date.now()+Math.max(this.minAnalysisMs,error.retryAfterMs||30000);
        this.snapshot.analysis.incomplete=true;
        if (this.snapshot.analysis.risk==='low') this.snapshot.analysis.risk='unknown';
        this.emit();
      }
    } finally {
      if (generation === this.generation) {
        this.busy=false;
        if (sequence < this.snapshot.sequence) this.request();
      }
    }
  }
  pause() {if(this.snapshot.status==='playing'){this.stopClock();this.snapshot.status='paused';clearTimeout(this.timer);this.emit();}}
  resume() {if(this.snapshot.status==='paused'){if(this.clock)this.clock.since=Date.now();this.snapshot.status='playing';this.emit();this.schedule();}}
  end(notify=true) {
    this.stopClock();this.generation++;clearTimeout(this.timer);clearTimeout(this.pending);this.controller?.abort();
    this.snapshot={...this.snapshot,status:'ended'};this.busy=false;
    if(notify)this.emit();
  }
}
