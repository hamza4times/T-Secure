import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { EVALUATION_SCENARIOS } from '../shared/evaluation.js';

export function backend() {
  const emulator=process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if(process.env.NODE_ENV==='production' && emulator)throw Object.assign(new Error('The server authentication configuration is unavailable.'),{status:503});
  if (!getApps().length) {
    if(emulator && process.env.FIREBASE_PROJECT_ID?.startsWith('demo-')){
      initializeApp({projectId:process.env.FIREBASE_PROJECT_ID});
      return {auth:getAuth(),db:getFirestore()};
    }
    let serviceAccount;
    try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'); }
    catch { throw Object.assign(new Error('The server Firebase configuration is invalid.'), {status:503}); }
    if (!serviceAccount.project_id) throw Object.assign(new Error('Firebase is not connected on the server yet.'), {status:503});
    initializeApp({credential:cert(serviceAccount)});
  }
  return {auth:getAuth(), db:getFirestore()};
}
export function createFirestoreStore(db) {
  const incident = (uid,id) => db.doc('users/' + uid + '/incidents/' + id);
  return {
    async getIncident(uid,id) { return (await incident(uid,id).get()).data(); },
    async saveIncident(uid,id,data) {
      await db.runTransaction(async (tx) => {
        const previous=(await tx.get(incident(uid,id))).data();
        if (!previous || data.sequence > previous.sequence) {
          if (previous?.risk === 'high') data.risk='high';
          tx.set(incident(uid,id),data);
        }
      });
    },
    // Synthetic scenarios and their measured results. Clients cannot read or write these directly.
    async saveEvaluation({provider,ranAt,runs}) {
      const batch=db.batch();
      for (const run of runs) {
        const scenario=EVALUATION_SCENARIOS.find((s)=>s.id===run.scenarioId);
        batch.set(db.doc('evaluationScenarios/' + run.scenarioId),{
          scenarioType:scenario.type,title:scenario.title,expectedIndicators:scenario.expected.tactics,expectedRiskLevel:scenario.expected.risk,
          expectedNextAction:scenario.expected.next,evaluationDate:ranAt,
          modelResults:{[provider.id]:{model:provider.model,ranAt,result:run.result?{...run.result,explanation:run.result.explanation?.slice(0,600)||null}:null,score:run.score,error:run.error,latencyMs:run.latencyMs,usage:run.usage}},
        },{merge:true});
      }
      await batch.commit();
    },
    async getEvaluations() {
      return (await db.collection('evaluationScenarios').get()).docs.map((doc)=>({id:doc.id,...doc.data()}));
    },
    async takeRateLimit(uid,kind,limit) {
      const bucket=Math.floor(Date.now()/60000);
      const target=db.doc('_limits/' + uid + '-' + kind);
      return db.runTransaction(async (tx) => {
        const previous=(await tx.get(target)).data();
        const count=previous?.bucket === bucket ? previous.count+1 : 1;
        if (count > limit) return false;
        tx.set(target,{bucket,count});return true;
      });
    },
  };
}
