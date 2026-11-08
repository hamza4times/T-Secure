import { analyzeText } from '../shared/detection.js';
import { extractIndicators, indicatorsToStore } from '../shared/network.js';
import { parseCommunication } from '../shared/schema.js';
import { analyzeConversation, maxLevel, turnsFromText, contactText } from '../shared/prediction.js';
import { buildReport } from '../shared/report.js';

const firebaseConfig={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID,
  ...(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?{storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}:{}),
  ...(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?{messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}:{}),
};
export const firebaseConfigured=['apiKey','authDomain','projectId','appId'].every((key)=>Boolean(firebaseConfig[key]));
export const DEFAULT_PREFERENCES=Object.freeze({language:'en',textSize:'standard',highContrast:false,reduceMotion:false,warningStyle:'standard',callAlertAudio:'visual',verificationMethods:['callback'],hasFamilyPassphrase:false});
export const MAX_CONTACTS=5;
const empty=()=>({user:null,demo:false,loading:false,profile:null,contacts:[],contact:null,incidents:[],warnings:[]});
const DEMO_KEY='tsecure:demo:v2';
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
    'auth/requires-recent-login':'For your security, please sign out, sign back in, and try again.',
    'permission-denied':'This change was not allowed. Please check the details and try again.',
  })[error.code] || error.message || 'Something went wrong. Please try again.';
}
export const preferencesOf=(state)=>({...DEFAULT_PREFERENCES,...(state.profile?.preferences||{})});
export const needsOnboarding=(state)=>Boolean(state.user)&&!state.profile?.onboardingCompleted;
export class Client {
  constructor() {this.state=empty();this.listeners=new Set();this.generation=0;this.unsubscribers=[];this.retryAt=new Map();}
  subscribe(listener) {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  emit() {this.state.contact=this.state.contacts[0]||null;for(const listener of this.listeners)listener(this.state);}
  persist() {
    if (!this.state.demo) return;
    const {profile,contacts,incidents,warnings}=this.state;
    try{localStorage.setItem(DEMO_KEY,JSON.stringify({active:true,profile,contacts,incidents,warnings}));return true;}catch{/* Demo remains usable without browser storage. */return false;}
  }
  enterDemo() {
    this.generation++;this.clearSubscriptions();this.state=empty();
    let saved={};try{saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}');}catch{/* Ignore damaged local demo state. */}
    this.state={...this.state,demo:true,user:{displayName:saved.profile?.displayName||'Demo guest',email:'Sample workspace',demo:true},
      profile:saved.profile||null,contacts:Array.isArray(saved.contacts)?saved.contacts:[],
      incidents:Array.isArray(saved.incidents)?saved.incidents:[],warnings:Array.isArray(saved.warnings)?saved.warnings:[]};
    this.persist();this.emit();
  }
  leaveDemo() {
    try{const saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}');localStorage.setItem(DEMO_KEY,JSON.stringify({...saved,active:false}));}catch{/* Optional. */}
  }
  clearSubscriptions() {this.unsubscribers.forEach((unsub)=>unsub());this.unsubscribers=[];}
  async init() {
    let resumeDemo=false;
    try{resumeDemo=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}').active===true;}catch{/* No saved demo. */}
    if(!firebaseConfigured){if(resumeDemo)this.enterDemo();else this.emit();return;}
    this.state.loading=true;this.emit();
    const [app,auth,db]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore')]);
    this.sdk={...auth,...db};this.firebaseApp=app.initializeApp(firebaseConfig);
    this.auth=auth.getAuth(this.firebaseApp);this.db=db.getFirestore(this.firebaseApp);
    if(import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true'){
      auth.connectAuthEmulator(this.auth,'http://127.0.0.1:9099',{disableWarnings:true});
      db.connectFirestoreEmulator(this.db,'127.0.0.1',8080);
    }
    if(resumeDemo)this.enterDemo();
    auth.onAuthStateChanged(this.auth,async(user)=>{
      if(this.state.demo)return;
      const generation=++this.generation;this.clearSubscriptions();this.retryAt.clear();
      this.state={...empty(),user,loading:!!user?.emailVerified};this.emit();
      if(!user?.emailVerified)return;
      try {
        const {doc,collection,query,orderBy,limit,onSnapshot}=this.sdk;
        const uid=user.uid;
        const watch=(target,callback,message)=>new Promise((resolve,reject)=>{
          this.unsubscribers.push(onSnapshot(target,(snapshot)=>{
            if(generation!==this.generation){resolve();return;}
            callback(snapshot);this.emit();resolve();
          },(error)=>{this.state.syncError=message;this.emit();reject(error);}));
        });
        await Promise.all([
          watch(doc(this.db,'users',uid),(s)=>{this.state.profile=s.data()||null;},'Your protection profile could not be loaded. Check your connection and retry.'),
          watch(query(collection(this.db,'users',uid,'trustedContacts'),orderBy('createdAt','asc'),limit(MAX_CONTACTS)),(s)=>{this.state.contacts=s.docs.map((d)=>({id:d.id,...d.data()}));},'Your trusted contacts could not be loaded.'),
          watch(query(collection(this.db,'users',uid,'incidents'),orderBy('updatedAt','desc'),limit(50)),(s)=>{this.state.incidents=s.docs.map((d)=>({id:d.id,...d.data()}));},'Your protection history could not be loaded.'),
          watch(query(collection(this.db,'users',uid,'warnings'),orderBy('displayedAt','desc'),limit(50)),(s)=>{this.state.warnings=s.docs.map((d)=>({id:d.id,...d.data(),displayedAt:d.data().displayedAt?.toDate?.().toISOString()||null}));},'Your warning history could not be loaded.'),
        ]);
      }catch(error){if(generation===this.generation)this.state.syncError=friendlyAuthError(error);}
      finally{if(generation===this.generation){this.state.loading=false;this.emit();}}
    });
  }
  requireFirebase() {if(!this.auth)throw new Error('Firebase is not connected yet. Use the demo, or add the project configuration to .env.');}
  prepareAuth() {
    if(this.state.demo){
      this.leaveDemo();this.generation++;this.clearSubscriptions();
      this.state=empty();this.emit();
    }
    this.state.demo=false;
  }
  async signup({name,email,password,confirm}) {
    this.requireFirebase();
    if(!name?.trim())throw new Error('Enter your name.');
    if(password.length<8)throw new Error('Choose a password with at least 8 characters.');
    if(password!==confirm)throw new Error('The two passwords do not match. Please type them again.');
    this.prepareAuth();
    const result=await this.sdk.createUserWithEmailAndPassword(this.auth,email,password);
    await this.sdk.updateProfile(result.user,{displayName:name.trim()});
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
    // Reinstall private subscriptions with the verified token.
    window.location.reload();
  }
  async logout() {
    this.generation++;this.clearSubscriptions();
    if(this.state.demo)this.leaveDemo();
    if(this.auth?.currentUser)await this.sdk.signOut(this.auth);
    this.state=empty();this.emit();
  }
  uid() {return this.auth.currentUser.uid;}
  // Profile: preferences that customize protection. Nothing here scores or judges the customer.
  async saveProfile(changes) {
    const preferences={...preferencesOf(this.state),...(changes.preferences||{})};
    const next={...(this.state.profile||{}),...changes,preferences};
    if(next.displayName!=null)next.displayName=String(next.displayName).trim().slice(0,80);
    if(!this.state.demo){
      const {doc,setDoc,serverTimestamp}=this.sdk;
      const write={...changes,preferences,updatedAt:serverTimestamp()};
      if(!this.state.profile)Object.assign(write,{createdAt:serverTimestamp(),email:this.auth.currentUser.email||null,protectionEnabled:true});
      if(write.email===null)delete write.email;
      if(changes.privacyAcknowledged){delete write.privacyAcknowledged;write.privacyAcknowledgedAt=serverTimestamp();}
      if(changes.displayName!=null){write.displayName=next.displayName;if(next.displayName&&next.displayName!==this.auth.currentUser.displayName)await this.sdk.updateProfile(this.auth.currentUser,{displayName:next.displayName});}
      await setDoc(doc(this.db,'users',this.uid()),write,{merge:true});
    }else if(next.displayName)this.state.user={...this.state.user,displayName:next.displayName};
    if(next.privacyAcknowledged)next.privacyAcknowledgedAt=new Date().toISOString();
    delete next.privacyAcknowledged;
    this.state.profile={protectionEnabled:true,...next};this.persist();this.emit();
  }
  async addContact(contact) {
    const value={displayName:String(contact.displayName||'').trim(),relationshipLabel:String(contact.relationshipLabel||'').trim(),phone:String(contact.phone||'').trim(),verificationPreference:['callback','passphrase','other-channel'].includes(contact.verificationPreference)?contact.verificationPreference:'callback'};
    if(!value.displayName||value.displayName.length>80||value.relationshipLabel.length>60||!/^[+0-9() .-]{7,30}$/.test(value.phone))throw new Error('Enter a contact name and a valid phone number.');
    if(this.state.contacts.length>=MAX_CONTACTS)throw new Error(`You can save up to ${MAX_CONTACTS} trusted contacts.`);
    const id=crypto.randomUUID();
    if(!this.state.demo){
      const {doc,setDoc,serverTimestamp}=this.sdk;
      await setDoc(doc(this.db,'users',this.uid(),'trustedContacts',id),{...value,createdAt:serverTimestamp()});
    }else{this.state.contacts=[...this.state.contacts,{id,...value,createdAt:new Date().toISOString()}];this.persist();this.emit();}
  }
  async deleteContact(id) {
    if(!this.state.demo)await this.sdk.deleteDoc(this.sdk.doc(this.db,'users',this.uid(),'trustedContacts',id));
    this.state.contacts=this.state.contacts.filter((c)=>c.id!==id);this.persist();this.emit();
  }
  // Records that a warning was shown and what the customer chose. Never transcript content.
  async logWarning({warningType,warningLevel,incidentId,channel}) {
    const id=crypto.randomUUID();
    const value={warningType,warningLevel,customerAction:'shown',channel,...(incidentId?{incidentId}:{})};
    if(!this.state.demo){
      const {doc,setDoc,serverTimestamp}=this.sdk;
      await setDoc(doc(this.db,'users',this.uid(),'warnings',id),{...value,displayedAt:serverTimestamp()});
    }else{this.state.warnings=[{id,...value,displayedAt:new Date().toISOString()},...this.state.warnings].slice(0,50);this.persist();}
    return id;
  }
  async updateWarning(id,customerAction) {
    if(!id)return;
    if(!this.state.demo)await this.sdk.updateDoc(this.sdk.doc(this.db,'users',this.uid(),'warnings',id),{customerAction});
    const item=this.state.warnings.find((w)=>w.id===id);if(item)item.customerAction=customerAction;this.persist();
  }
  async api(path,body,method='GET',signal) {
    const user=this.auth?.currentUser;
    if(!user?.emailVerified)throw new Error('Sign in with a verified email to continue.');
    // An AI outage must never prevent deletion or other checks.
    const retryKey=path.startsWith('/api/analyze')?path:null;
    const retryAt=this.retryAt.get(retryKey)||0;
    if(Date.now()<retryAt)throw Object.assign(new Error('This analysis is recovering. Standard warning checks are still available. Please try again shortly.'),{status:503,retryAfterMs:retryAt-Date.now()});
    const token=await user.getIdToken();
    const response=await fetch(path,{method,signal:signal||AbortSignal.timeout(path.includes('benchmark')?65000:35000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
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
  async analyze(input,signal) {
    if(!this.state.demo)return this.api(input.channel==='call'?'/api/analyze-call':'/api/analyze-sms',input,'POST',signal);
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    parseCommunication(input); // Same validation as the server, so demo and connected modes reject the same input.
    const insight=analyzeConversation(turnsFromText(input.text));
    const result={...analyzeText(contactText(input.text)),sessionId:input.sessionId||crypto.randomUUID(),sequence:input.sequence,local:true};
    result.risk=maxLevel(result.risk,insight.level);
    result.report=buildReport({communicationType:input.channel,level:result.risk,insight,source:'rules'});
    result.provider={id:'rules',label:'Rule-based checks in your browser',model:'deterministic rules'};
    const previous=this.state.incidents.find((i)=>i.id===result.sessionId);
    const incident={id:result.sessionId,channel:input.channel,source:input.source||'user',risk:result.risk,riskScore:result.report.risk_score,reasonCodes:[...new Set(result.reasons.map((r)=>r.code))],tactics:[...new Set(insight.findings.map((f)=>f.tactic))],predictedAction:result.report.predicted_next_action?.action||null,analysisSource:'rules',updatedAt:new Date().toISOString(),recovery:previous?.recovery||[]};
    if(previous?.risk==='high')incident.risk='high';
    const indicators=indicatorsToStore(extractIndicators({text:input.text,sender:input.sender}),incident.risk);
    if(indicators)incident.indicators=indicators;
    this.state.incidents=[incident,...this.state.incidents.filter((i)=>i.id!==incident.id)].slice(0,50);
    result.saved=this.persist();return result;
  }
  async deleteIncident(id) {
    if(!this.state.demo)await this.sdk.deleteDoc(this.sdk.doc(this.db,'users',this.uid(),'incidents',id));
    this.state.incidents=this.state.incidents.filter((i)=>i.id!==id);this.persist();this.emit();
  }
  async deleteCollection(name) {
    const {collection,query,limit,getDocs,writeBatch}=this.sdk;
    for(;;){
      const snapshot=await getDocs(query(collection(this.db,'users',this.uid(),name),limit(200)));
      if(snapshot.empty)return;
      const batch=writeBatch(this.db);snapshot.docs.forEach((d)=>batch.delete(d.ref));await batch.commit();
    }
  }
  async deleteAllHistory() {
    if(!this.state.demo){await this.deleteCollection('incidents');await this.deleteCollection('warnings');}
    this.state.incidents=[];this.state.warnings=[];this.persist();this.emit();
  }
  async deleteAccount() {
    if(this.state.demo){try{localStorage.removeItem(DEMO_KEY);}catch{/* Optional. */}this.state=empty();this.emit();return;}
    this.requireFirebase();
    for(const name of ['incidents','warnings','trustedContacts'])await this.deleteCollection(name);
    await this.sdk.deleteDoc(this.sdk.doc(this.db,'users',this.uid()));
    await this.sdk.deleteUser(this.auth.currentUser);
    this.generation++;this.clearSubscriptions();this.state=empty();this.emit();
  }
  async saveRecovery(id,steps) {
    if(!this.state.demo)await this.sdk.updateDoc(this.sdk.doc(this.db,'users',this.uid(),'incidents',id),{recovery:steps});
    const item=this.state.incidents.find((i)=>i.id===id);if(item)item.recovery=steps;this.persist();
  }
  benchmarkStatus() {return this.api('/api/benchmark-models');}
  runBenchmark(provider) {return this.api('/api/benchmark-models',{provider},'POST');}
}
