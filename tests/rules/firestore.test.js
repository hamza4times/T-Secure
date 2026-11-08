import test, {before,after,beforeEach} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
let environment;
before(async()=>{
  environment=await initializeTestEnvironment({projectId:'demo-tsecure',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{await environment?.cleanup();});
beforeEach(async()=>{
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async(context)=>{
    const db=context.firestore();
    await setDoc(doc(db,'users/alice'),{displayName:'Alice',onboardingCompleted:true});
    await setDoc(doc(db,'users/alice/incidents/example'),{risk:'high',channel:'message',recovery:[]});
    await setDoc(doc(db,'users/alice/warnings/w1'),{warningType:'financial',warningLevel:'high',customerAction:'shown'});
    await setDoc(doc(db,'evaluationScenarios/call-family-a'),{scenarioType:'call'});
  });
});
const db=(uid='alice',verified=true)=>environment.authenticatedContext(uid,{email_verified:verified,email:uid+'@example.com'}).firestore();
const contact={displayName:'Jordan',relationshipLabel:'Family',phone:'+1 202 555 0143',verificationPreference:'callback'};

test('verified owners can read and update their profile with valid preferences',async()=>{
  await assertSucceeds(getDoc(doc(db(),'users/alice')));
  await assertSucceeds(setDoc(doc(db(),'users/alice'),{preferences:{textSize:'large',highContrast:true,verificationMethods:['callback','passphrase'],warningStyle:'high-only'},updatedAt:serverTimestamp()},{merge:true}));
});
test('profiles reject psychological or scoring fields and invalid preferences',async()=>{
  await assertFails(setDoc(doc(db(),'users/alice'),{vulnerabilityScore:83},{merge:true}));
  await assertFails(setDoc(doc(db(),'users/alice'),{preferences:{mentalHealth:'x'}},{merge:true}));
  await assertFails(setDoc(doc(db(),'users/alice'),{preferences:{textSize:'huge'}},{merge:true}));
  await assertFails(setDoc(doc(db(),'users/alice'),{email:'someone-else@example.com'},{merge:true}));
});
test('other, unverified, and unauthenticated users cannot read private data',async()=>{
  await assertFails(getDoc(doc(db('bob'),'users/alice')));
  await assertFails(getDoc(doc(db('bob'),'users/alice/incidents/example')));
  await assertFails(getDoc(doc(db('alice',false),'users/alice')));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(),'users/alice/warnings/w1')));
});
test('trusted contacts must have bounded fields and a phone number',async()=>{
  const target=doc(db(),'users/alice/trustedContacts/c1');
  await assertSucceeds(setDoc(target,{...contact,createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db(),'users/alice/trustedContacts/c2'),{...contact,phone:'javascript:alert(1)',createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db(),'users/alice/trustedContacts/c3'),{...contact,score:0,createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db('bob'),'users/alice/trustedContacts/c4'),{...contact,createdAt:serverTimestamp()}));
});
test('warnings record only the type, level, time, and customer action',async()=>{
  await assertSucceeds(setDoc(doc(db(),'users/alice/warnings/w2'),{warningType:'financial',warningLevel:'high',customerAction:'shown',channel:'call',displayedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(db(),'users/alice/warnings/w3'),{warningType:'financial',warningLevel:'high',customerAction:'shown',displayedAt:serverTimestamp(),transcript:'Send money'}));
  await assertSucceeds(updateDoc(doc(db(),'users/alice/warnings/w1'),{customerAction:'dismissed'}));
  await assertFails(updateDoc(doc(db(),'users/alice/warnings/w1'),{warningLevel:'caution'}));
  await assertFails(updateDoc(doc(db(),'users/alice/warnings/w1'),{customerAction:'sent-money-to-scammer'}));
});
test('owners can update recovery without altering analysis',async()=>{
  const incident=doc(db(),'users/alice/incidents/example');
  await assertSucceeds(updateDoc(incident,{recovery:['stop','evidence','credit']}));
  await assertFails(updateDoc(incident,{risk:'low'}));
  await assertFails(updateDoc(incident,{recovery:['https://untrusted.test']}));
});
test('incident creation is server only and deletion is owner only',async()=>{
  await assertFails(setDoc(doc(db(),'users/alice/incidents/forged'),{risk:'low'}));
  await assertFails(deleteDoc(doc(db('bob'),'users/alice/incidents/example')));
  await assertSucceeds(deleteDoc(doc(db(),'users/alice/incidents/example')));
});
test('evaluation results and rate limits are server only',async()=>{
  await assertFails(getDoc(doc(db(),'evaluationScenarios/call-family-a')));
  await assertFails(setDoc(doc(db(),'evaluationScenarios/forged'),{modelResults:{}}));
  await assertFails(getDoc(doc(db(),'_limits/alice-analysis')));
  await assertFails(setDoc(doc(db(),'_limits/alice-analysis'),{count:0}));
});
