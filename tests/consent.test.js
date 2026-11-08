import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingConsentFor } from '../shared/consent.js';
test('signup consent belongs only to the account that explicitly opted in',()=>{
  const stored=JSON.stringify({uid:'alice',enabled:true});
  assert.equal(pendingConsentFor(stored,'alice'),true);
  assert.equal(pendingConsentFor(stored,'bob'),false);
});
test('disabled, malformed, and legacy unbound consent never enable analysis',()=>{
  for(const value of ['yes','not json',null,JSON.stringify({uid:'alice',enabled:false})]){
    assert.equal(pendingConsentFor(value,'alice'),false);
  }
});
