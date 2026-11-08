import test, {before,after,beforeEach} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
let environment;
before(async()=>{
  environment=await initializeTestEnvironment({projectId:'demo-tsecure',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{await environment?.cleanup();});
beforeEach(async()=>{
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async(context)=>{
    const db=context.firestore();
    await setDoc(doc(db,'users/alice/private/assessment'),{score:83});
    await setDoc(doc(db,'users/alice/private/consent'),{enabled:true,revision:1});
    await setDoc(doc(db,'users/alice/incidents/example'),{risk:'high',channel:'message',recovery:[]});
  });
});
const db=(uid='alice',verified=true)=>environment.authenticatedContext(uid,{email_verified:verified}).firestore();
test('verified owners can read their private assessment',async()=>{
  await assertSucceeds(getDoc(doc(db(),'users/alice/private/assessment')));
});
test('other users cannot read an assessment or incident',async()=>{
  await assertFails(getDoc(doc(db('bob'),'users/alice/private/assessment')));
  await assertFails(getDoc(doc(db('bob'),'users/alice/incidents/example')));
});
test('unverified and unauthenticated users cannot read private data',async()=>{
  await assertFails(getDoc(doc(db('alice',false),'users/alice/private/assessment')));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(),'users/alice/private/assessment')));
});
test('clients cannot forge scores or advance consent versions',async()=>{
  await assertFails(setDoc(doc(db(),'users/alice/private/assessment'),{score:0}));
  await assertFails(updateDoc(doc(db(),'users/alice/private/consent'),{enabled:true,revision:99}));
});
test('trusted contact must have bounded fields and a phone number',async()=>{
  const contact=doc(db(),'users/alice/settings/contact');
  await assertSucceeds(setDoc(contact,{name:'Jordan',relationship:'Family',phone:'+1 202 555 0143'}));
  await assertFails(setDoc(contact,{name:'Jordan',relationship:'Family',phone:'javascript:alert(1)'}));
  await assertFails(setDoc(contact,{name:'Jordan',relationship:'Family',phone:'2025550143',score:0}));
});
test('owners can update recovery without altering analysis',async()=>{
  const incident=doc(db(),'users/alice/incidents/example');
  await assertSucceeds(updateDoc(incident,{recovery:['stop','report']}));
  await assertFails(updateDoc(incident,{risk:'low'}));
  await assertFails(updateDoc(incident,{recovery:['https://untrusted.test']}));
});
test('incident creation is server only and deletion is owner only',async()=>{
  await assertFails(setDoc(doc(db(),'users/alice/incidents/forged'),{risk:'low'}));
  await assertFails(deleteDoc(doc(db('bob'),'users/alice/incidents/example')));
  await assertSucceeds(deleteDoc(doc(db(),'users/alice/incidents/example')));
});
test('internal rate limit records cannot be accessed by clients',async()=>{
  await assertFails(getDoc(doc(db(),'_limits/alice-analysis')));
  await assertFails(setDoc(doc(db(),'_limits/alice-analysis'),{count:0}));
});
