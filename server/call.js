import {randomUUID} from 'node:crypto';
import {httpError} from './auth.js';
import {parseCommunication,validateModelAnalysis} from '../shared/schema.js';
import {analyzeText,mergeAnalysis} from '../shared/detection.js';
import {scenarios} from '../shared/fixtures.js';
import {unknownEmotion} from '../shared/emotion.js';

export function createCallService({model}) {
  return {
    async analyze(body) {
      let input;try{input=parseCommunication({...body,channel:'call'});}catch(error){throw httpError(400,error.message);}
      let result={...analyzeText(input.text),emotion:unknownEmotion()},incomplete=false;
      try {
        const ai=validateModelAnalysis(await model('communication',{text:input.text,channel:'call',turns:input.turns}),input.text,input.turns);
        result=mergeAnalysis(result,{...ai,analysisSource:'hybrid'});
      }catch{incomplete=true;if(result.risk==='low')result.risk='unknown';}
      return {...result,incomplete,sequence:input.sequence,sessionId:input.sessionId||randomUUID()};
    },
    async reply(body) {
      const scenario=scenarios.find(item=>item.id===body.scenarioId);
      if(!scenario||!Array.isArray(body.turns)||body.turns.length>60)throw httpError(400,'Choose a practice scenario and a short conversation.');
      if(body.turns.some(turn=>!['contact','user'].includes(turn?.speaker)||typeof turn.text!=='string'||!turn.text.trim()||turn.text.length>2000)||body.turns.reduce((sum,turn)=>sum+turn.text.length,0)>12000)throw httpError(400,'The caller conversation is invalid or too long.');
      const result=await model('caller',{
        scenario:{id:scenario.id,name:scenario.name,description:scenario.description},
        turns:body.turns.map(({speaker,text})=>({speaker,text})),
      });
      if(typeof result?.text!=='string'||!result.text.trim()||result.text.length>600)throw httpError(503,'The practice caller could not respond. Please try again.');
      return {text:result.text.trim()};
    },
  };
}
