export const EMOTIONS = Object.freeze({
  sadness: 'sad', fear: 'afraid', anxiety: 'anxious', loneliness: 'lonely',
  overwhelm: 'overwhelmed', excitement: 'excited', neutral: 'calm', unknown: null,
});
export const unknownEmotion = () => ({label:'unknown',turnId:null,evidence:''});

// Only the latest explicitly attributed user turn can support a current cue.
// Caller claims, mixed microphone audio, and model-written advice are excluded.
export function validateEmotion(value, turns=[]) {
  const latest=turns.findLast(turn=>turn.speaker==='user');
  if(!value || !Object.hasOwn(EMOTIONS,value.label) || value.label==='unknown' ||
    !latest || typeof value.turnId!=='string' || value.turnId!==String(latest.id) ||
    typeof value.evidence!=='string' || value.evidence.trim().length<3 ||
    value.evidence.length>500 || !latest.text.includes(value.evidence))return unknownEmotion();
  return {label:value.label,turnId:value.turnId,evidence:value.evidence};
}

export function supportiveGuidance(label) {
  if(!Object.hasOwn(EMOTIONS,label) || ['neutral','unknown'].includes(label))return null;
  return `You may be feeling ${EMOTIONS[label]}. Is everything okay? Scammers can use strong feelings to pressure people. Take your time, and verify who you’re speaking with using a number you already trust before sharing information or sending money.`;
}

export function emotionWarning(analysis, callerTrust='unknown') {
  const risky=['caution','high'].includes(analysis?.risk) && analysis?.reasons?.length>0;
  return callerTrust!=='trusted'||risky ? supportiveGuidance(analysis?.emotion?.label) : null;
}
