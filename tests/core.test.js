import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import { parseCommunication, validateModelAnalysis } from '../shared/schema.js';

test('warns about a request to disclose a verification code', () => {
  assert.equal(analyzeText('I am from your bank. Read me your verification code.').risk, 'high');
});
test('warns about family impersonation with secret payment pressure', () => {
  assert.equal(analyzeText('Grandma, it is your grandson. Do not tell anyone. Send gift cards now.').risk, 'high');
});
test('benign urgency and ordinary trust do not establish a scam', () => {
  assert.equal(analyzeText('Please hurry to dinner. Keep the surprise party secret!').risk, 'low');
});
test('flags deceptive URL structure without navigating to it', () => {
  assert.equal(analyzeText('Pay at https://bank.example@192.0.2.1/login').risk, 'caution');
});
test('protective instructions to never share a code do not raise a warning', () => {
  assert.equal(analyzeText('Your bank will never ask for a code. Do not send your password to anyone.').risk,'low');
  assert.equal(analyzeText('Never share your password. Now send your verification code to me.').risk,'high');
});
test('model output cannot downgrade an existing high warning', () => {
  assert.equal(mergeAnalysis({ risk: 'high', reasons: [{ code: 'credentials', evidence: 'read me the code' }] }, { risk: 'low', reasons: [] }).risk, 'high');
});
test('model evidence must exist in source text and actions are application owned', () => {
  assert.throws(() => validateModelAnalysis({risk:'high',reasons:[{code:'credentials',evidence:'invented'}]}, 'Hello there'));
  const output = validateModelAnalysis({risk:'high',reasons:[{code:'credentials',evidence:'send your password'}],actions:['https://evil.test']}, 'Please send your password');
  assert.ok(!JSON.stringify(output).includes('evil.test'));
});
test('communication rejects oversized content and invalid sequence', () => {
  assert.throws(() => parseCommunication({channel:'call',text:'x'.repeat(12001),sequence:1}));
  assert.throws(() => parseCommunication({channel:'call',text:'hello',sequence:-1}));
});

