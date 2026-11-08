import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
  const ref = (uid,doc) => db.doc('users/' + uid + '/private/' + doc);
  const incident = (uid,id) => db.doc('users/' + uid + '/incidents/' + id);
  return {
    async getConsent(uid) { return (await ref(uid,'consent').get()).data() || {enabled:false,revision:0,historySetId:'pressure'}; },
    async setConsent(uid,enabled,historySetId,consentVersion) {
      return db.runTransaction(async (tx) => {
        const snapshot=await tx.get(ref(uid,'consent'));
        const value={enabled,historySetId,consentVersion,revision:(snapshot.data()?.revision || 0)+1,consentedAt:new Date().toISOString()};
        tx.set(ref(uid,'consent'),value);
        tx.delete(ref(uid,'assessment'));
        return value;
      });
    },
    async commitAssessment(uid,revision,assessment) {
      return db.runTransaction(async (tx) => {
        const consent=(await tx.get(ref(uid,'consent'))).data();
        if (!consent?.enabled || consent.revision !== revision) return false;
        tx.set(ref(uid,'assessment'),assessment); return true;
      });
    },
    async getAssessment(uid) { return (await ref(uid,'assessment').get()).data() || null; },
    async clearAssessment(uid) {
      await db.runTransaction(async (tx) => {
        const snapshot=await tx.get(ref(uid,'consent'));
        tx.set(ref(uid,'consent'),{...(snapshot.data() || {enabled:false,historySetId:'pressure'}),revision:(snapshot.data()?.revision || 0)+1});
        tx.delete(ref(uid,'assessment'));
      });
    },
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
