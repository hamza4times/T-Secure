import { analyzeText } from '../shared/detection.js';
import { calculateAssessment, validateOpportunities, CONSENT_VERSION } from '../shared/scoring.js';
import { getHistory, historySets } from '../shared/fixtures.js';
import { pendingConsentFor } from '../shared/consent.js';
import { extractIndicators, indicatorsToStore } from '../shared/network.js';
import { parseCommunication } from '../shared/schema.js';
import { analyzeConversation, maxLevel, turnsFromText } from '../shared/prediction.js';

const firebaseConfig={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID,
  ...(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?{storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}:{}),
  ...(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?{messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}:{}),
};
export const firebaseConfigured=['apiKey','authDomain','projectId','appId'].every((key)=>Boolean(firebaseConfig[key]));
const empty=()=>({user:null,demo:false,loading:false,contact:null,incidents:[],assessment:null,consent:{enabled:false,revision:0,historySetId:'pressure'},onboarding:false});
const DEMO_KEY='tsecure:demo:v1';
export function friendlyAuthError(error) {
  return ({
    'auth/invalid-credential':'The email or password did not match. Please try again.',
    'auth/email-already-in-use':'This email already has an account. Please sign in.',
    'auth/weak-password':'Choose a password with at least 8 characters.',
    'auth/popup-closed-by-user':'Google sign-in was cancelled. You can try again or use email.',
    'auth/popup-blocked':'Your browser blocked Google sign-in. Allow the popup or use email.',
    'auth/network-request-failed':'We could not connect. Check your connection and try again.',
    'auth/too-many-requests':'Please wait a little before trying again.',
    'auth/invalid-email':'Enter a valid email address.',
  })[error.code] || error.message || 'Something went wrong. Please try again.';
}
export class Client {
  constructor() {this.state=empty();this.listeners=new Set();this.generation=0;this.assessmentRequest=0;this.unsubscribers=[];this.retryAt=new Map();}
  subscribe(listener) {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  emit() {for(const listener of this.listeners)listener(this.state);}
  persist() {
    if (!this.state.demo) return;
    const {consent,contact,assessment,incidents}=this.state;
    try{localStorage.setItem(DEMO_KEY,JSON.stringify({consent,contact,assessment,incidents}));return true;}catch{/* Demo remains usable without browser storage. */return false;}
  }
  enterDemo() {
    this.generation++;this.assessmentRequest++;this.clearSubscriptions();this.state=empty();
    let saved={};try{saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}');}catch{/* Ignore damaged local demo state. */}
    this.state={...this.state,demo:true,user:{displayName:'Demo guest',email:'Sample workspace',demo:true},
      consent:saved.consent || this.state.consent,contact:saved.contact || null,
      assessment:saved.consent?.enabled ? saved.assessment || null : null,incidents:Array.isArray(saved.incidents)?saved.incidents:[]};
    this.emit();
  }
  clearSubscriptions() {this.unsubscribers.forEach((unsub)=>unsub());this.unsubscribers=[];}
  async init() {
    if(!firebaseConfigured){this.enterDemo();return;}
    this.state.loading=true;this.emit();
    const [app,auth,db]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore')]);
    this.sdk={...auth,...db};this.firebaseApp=app.initializeApp(firebaseConfig);
    this.auth=auth.getAuth(this.firebaseApp);this.db=db.getFirestore(this.firebaseApp);
    if(import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true'){
      auth.connectAuthEmulator(this.auth,'http://127.0.0.1:9099',{disableWarnings:true});
      db.connectFirestoreEmulator(this.db,'127.0.0.1',8080);
    }
    auth.onAuthStateChanged(this.auth,async(user)=>{
      if(this.state.demo)return;
      const generation=++this.generation;this.clearSubscriptions();this.retryAt.clear();
      this.state={...empty(),user,loading:!!user?.emailVerified};this.emit();
      if(!user?.emailVerified)return;
      try {
        await this.loadPrivate(generation);
        if(generation!==this.generation)return;
        const uid=user.uid;
        const ready=[];
        const watch=(path,callback)=>new Promise((resolve,reject)=>{
          const unsub=this.sdk.onSnapshot(this.sdk.doc(this.db,...path),(snapshot)=>{
            if(generation!==this.generation){resolve();return;}
            callback(snapshot.data());this.emit();resolve();
          },(error)=>{this.state.syncError='Some account data could not be loaded. Check your connection and retry.';this.emit();reject(error);});
          this.unsubscribers.push(unsub);
        });
        ready.push(watch(['users',uid,'settings','contact'],(value)=>{this.state.contact=value || null;}));
        ready.push(watch(['users',uid,'private','assessment'],(value)=>{this.state.assessment=this.state.consent.enabled ? value || null : null;}));
        ready.push(watch(['users',uid,'private','consent'],(value)=>{
          this.state.consent=value || this.state.consent;if(!value?.enabled)this.state.assessment=null;
        }));
        ready.push(new Promise((resolve,reject)=>{
          this.unsubscribers.push(this.sdk.onSnapshot(this.sdk.query(this.sdk.collection(this.db,'users',uid,'incidents'),this.sdk.orderBy('updatedAt','desc'),this.sdk.limit(50)),(snapshot)=>{
            if(generation!==this.generation){resolve();return;}
            this.state.incidents=snapshot.docs.map((doc)=>({id:doc.id,...doc.data()}));this.emit();resolve();
          },(error)=>{this.state.syncError='Your recent checks could not be loaded.';this.emit();reject(error);}));
        }));
        await Promise.all(ready);
        if(generation!==this.generation)return;
        const pending=sessionStorage.getItem('tsecure:pending-advanced');
        if(pendingConsentFor(pending,uid)){
          sessionStorage.removeItem('tsecure:pending-advanced');await this.setConsent(true,'pressure');
          this.assess().catch(()=>{if(generation===this.generation){this.state.syncError='Your preferences were saved. Advanced analysis is unavailable right now; standard checks still work.';this.emit();}});
        }
      }catch(error){if(generation===this.generation)this.state.syncError=friendlyAuthError(error);}
      finally{if(generation===this.generation){this.state.loading=false;this.emit();}}
    });
  }
  async loadPrivate(generation=this.generation) {
    const result=await this.api('/api/profile');
    if(generation!==this.generation)return;
    Object.assign(this.state,result);
    this.state.onboarding=result.consent?.revision===0;
    this.emit();
  }
  requireFirebase() {if(!this.auth)throw new Error('Firebase is not connected yet. Use the local demo, or add the project configuration in .env.local.');}
  prepareAuth() {
    if(this.state.demo){
      this.generation++;this.assessmentRequest++;this.clearSubscriptions();
      this.state=empty();this.emit();
    }
    this.state.demo=false;
  }
  async signup({name,email,password,advanced}) {
    this.requireFirebase();
    if(password.length<8)throw new Error('Choose a password with at least 8 characters.');
    this.prepareAuth();
    const result=await this.sdk.createUserWithEmailAndPassword(this.auth,email,password);
    sessionStorage.setItem('tsecure:pending-advanced',JSON.stringify({uid:result.user.uid,enabled:advanced}));
    await this.sdk.updateProfile(result.user,{displayName:name});
    await this.sdk.sendEmailVerification(result.user);
    this.state.user=result.user;this.emit();
  }
  async login(email,password) {this.requireFirebase();this.prepareAuth();await this.sdk.signInWithEmailAndPassword(this.auth,email,password);}
  async google() {this.requireFirebase();this.prepareAuth();await this.sdk.signInWithPopup(this.auth,new this.sdk.GoogleAuthProvider());}
  async reset(email) {this.requireFirebase();await this.sdk.sendPasswordResetEmail(this.auth,email);}
  async resend() {this.requireFirebase();await this.sdk.sendEmailVerification(this.auth.currentUser);}
  async refreshVerification() {
    this.requireFirebase();await this.sdk.reload(this.auth.currentUser);
    const user=this.auth.currentUser;
    if(!user.emailVerified)throw new Error('Your email is not verified yet. Open the verification email, then check again.');
    await user.getIdToken(true);
    this.state.user=user;this.state.loading=true;this.emit();
    // Reinstall private subscriptions and process optional onboarding through init.
    // An unavailable optional AI provider must not interrupt email verification.
    window.location.reload();
  }
  async logout() {
    this.generation++;this.assessmentRequest++;this.clearSubscriptions();
    if(this.auth?.currentUser)await this.sdk.signOut(this.auth);
    this.state=empty();this.emit();
  }
  async api(path,body,method='GET',signal) {
    const user=this.auth?.currentUser;
    if(!user?.emailVerified)throw new Error('Sign in with a verified email to continue.');
    // An AI outage must never prevent consent changes, deletion, or other checks.
    const retryKey=['/api/analyze','/api/profile/analyze'].includes(path)?path:null;
    const retryAt=this.retryAt.get(retryKey)||0;
    if(Date.now()<retryAt)throw Object.assign(new Error('This analysis is recovering. Standard warning checks are still available. Please try again shortly.'),{status:503,retryAfterMs:retryAt-Date.now()});
    const token=await user.getIdToken();
    const response=await fetch(path,{method,signal:signal||AbortSignal.timeout(35000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    let result;
    try{result=await response.json();}catch{/* A gateway or failed function can return text or HTML. */}
    const valid=result&&typeof result==='object'&&!Array.isArray(result);
    if(!response.ok||!valid){
      const status=response.ok?502:response.status;
      const retryAfter=Number(response.headers.get('Retry-After')||0);
      const retryAfterMs=[429,503].includes(status)?Math.max(30000,Number.isFinite(retryAfter)?retryAfter*1000:0):0;
      if(retryKey&&retryAfterMs)this.retryAt.set(retryKey,Date.now()+retryAfterMs);
      const message=!response.ok&&valid&&typeof result.error==='string'&&result.error.trim()&&result.error.length<=500
        ?result.error
        :response.ok?'The server returned an unexpected response. Please try again.'
        :status===401?'Your session has expired. Please sign in again.'
        :status===403?'This request is not available for your account.'
        :'The server is temporarily unavailable. Please try again shortly.';
      throw Object.assign(new Error(message),{status,retryAfterMs});
    }
    return result;
  }
  async setConsent(enabled,historySetId=this.state.consent.historySetId) {
    if(!historySets.some((h)=>h.id===historySetId))throw new Error('Choose a sample history.');
    this.assessmentRequest=(this.assessmentRequest||0)+1;
    if(this.state.demo){
      this.state.consent={enabled,historySetId,revision:this.state.consent.revision+1,consentVersion:CONSENT_VERSION,consentedAt:new Date().toISOString()};
    }else{
      this.state.consent=await this.api('/api/profile/consent',{enabled,historySetId},'POST');
    }
    this.state.assessment=null;this.state.onboarding=false;this.persist();this.emit();
  }
  async assess() {
    if(!this.state.consent.enabled)throw new Error('Enable advanced analysis first.');
    const request=++this.assessmentRequest;
    const revision=this.state.consent.revision;
    let assessment;
    if(this.state.demo){
      await new Promise((resolve)=>setTimeout(resolve,450));
      const history=getHistory(this.state.consent.historySetId);
      assessment=calculateAssessment(validateOpportunities(history.expected,history.conversations),{
        historySetId:history.id,generatedAt:new Date().toISOString(),windowStart:history.windowStart,windowEnd:history.windowEnd,modelVersion:'Annotated sample evidence',analysisSource:'demo-fixture',
      });
    }else assessment=await this.api('/api/profile/analyze',{historySetId:this.state.consent.historySetId},'POST');
    if(request!==this.assessmentRequest || !this.state.consent.enabled || revision!==this.state.consent.revision)return;
    this.state.assessment=assessment;this.persist();this.emit();
    return assessment;
  }
  async deleteAssessment() {
    this.assessmentRequest=(this.assessmentRequest||0)+1;
    if(!this.state.demo)await this.api('/api/profile',undefined,'DELETE');
    this.state.assessment=null;this.persist();this.emit();
  }
  async analyze(input,signal) {
    if(!this.state.demo)return this.api('/api/analyze',input,'POST',signal);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    parseCommunication(input); // Same validation as the server, so demo and connected modes reject the same input.
    const result={...analyzeText(input.text),sessionId:input.sessionId||crypto.randomUUID(),sequence:input.sequence,local:true};
    result.risk=maxLevel(result.risk,analyzeConversation(turnsFromText(input.text)).level);
    const previous=this.state.incidents.find((i)=>i.id===result.sessionId);
    const incident={id:result.sessionId,channel:input.channel,source:input.source||'user',risk:result.risk,reasonCodes:[...new Set(result.reasons.map((r)=>r.code))],updatedAt:new Date().toISOString(),recovery:previous?.recovery||[]};
    if(previous?.risk==='high')incident.risk='high';
    const indicators=indicatorsToStore(extractIndicators({text:input.text,sender:input.sender}),incident.risk);
    if(indicators)incident.indicators=indicators;
    this.state.incidents=[incident,...this.state.incidents.filter((i)=>i.id!==incident.id)].slice(0,50);
    result.saved=this.persist();return result;
  }
  async saveContact(contact) {
    if(!contact.name.trim() || contact.name.length>80 || contact.relationship.length>60 || !/^[+0-9() .-]{7,30}$/.test(contact.phone))throw new Error('Enter a contact name and a valid phone number.');
    if(!this.state.demo)await this.sdk.setDoc(this.sdk.doc(this.db,'users',this.auth.currentUser.uid,'settings','contact'),contact);
    this.state.contact=contact;this.persist();this.emit();
  }
  async deleteContact() {
    if(!this.state.demo)await this.sdk.deleteDoc(this.sdk.doc(this.db,'users',this.auth.currentUser.uid,'settings','contact'));
    this.state.contact=null;this.persist();this.emit();
  }
  async deleteIncident(id) {
    if(!this.state.demo)await this.sdk.deleteDoc(this.sdk.doc(this.db,'users',this.auth.currentUser.uid,'incidents',id));
    this.state.incidents=this.state.incidents.filter((i)=>i.id!==id);this.persist();this.emit();
  }
  async saveRecovery(id,steps) {
    if(!this.state.demo)await this.sdk.updateDoc(this.sdk.doc(this.db,'users',this.auth.currentUser.uid,'incidents',id),{recovery:steps});
    const item=this.state.incidents.find((i)=>i.id===id);if(item)item.recovery=steps;this.persist();
  }
}
