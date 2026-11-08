import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, mergeAnalysis } from '../shared/detection.js';
import { calculateAssessment, validateOpportunities } from '../shared/scoring.js';
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

const conversations = [
  {id:'c1',turns:[{id:'a',speaker:'contact',text:'Read me your code'},{id:'b',speaker:'user',text:'I will give it to you'}]},
  {id:'c2',turns:[{id:'a',speaker:'contact',text:'Send the gift cards'},{id:'b',speaker:'user',text:'I will call my bank instead'}]},
  {id:'c3',turns:[{id:'a',speaker:'contact',text:'Pay and keep this secret'},{id:'b',speaker:'user',text:'I will send the money'}]},
];
const evidence = [
  {id:'1',conversationId:'c1',requestTurnId:'a',responseTurnId:'b',category:'credentials',classification:'risky',evidence:'I will give it to you'},
  {id:'2',conversationId:'c1',requestTurnId:'a',responseTurnId:'b',category:'urgency',classification:'unclear',evidence:'I will give it to you'},
  {id:'3',conversationId:'c2',requestTurnId:'a',responseTurnId:'b',category:'payment',classification:'protective',evidence:'I will call my bank instead'},
  {id:'4',conversationId:'c3',requestTurnId:'a',responseTurnId:'b',category:'secrecy',classification:'risky',evidence:'I will send the money'},
];
test('score excludes unclear responses and requires enough distinct evidence', () => {
  const result = calculateAssessment(evidence);
  assert.equal(result.score, null);
  assert.equal(result.coverage.assessable, 3);
});
test('five opportunities across three conversations produce a hand-calculated score', () => {
  const result = calculateAssessment([
    {id:'1',conversationId:'a',classification:'risky',category:'payment'},
    {id:'2',conversationId:'a',classification:'risky',category:'credentials'},
    {id:'3',conversationId:'b',classification:'protective',category:'urgency'},
    {id:'4',conversationId:'b',classification:'protective',category:'secrecy'},
    {id:'5',conversationId:'c',classification:'protective',category:'family'},
  ]);
  assert.equal(result.score, 40);
  assert.equal(result.coverage.risky, 2);
});
test('incoming scam volume without user responses cannot create a score', () => {
  assert.equal(calculateAssessment([]).score, null);
});
test('duplicate model evidence cannot inflate score coverage', () => {
  const valid = validateOpportunities([evidence[0], {...evidence[0], id:'duplicate'}], conversations);
  assert.equal(valid.length, 1);
});
test('a single user reply cannot be counted repeatedly under different requests', () => {
  const conversation={id:'one',turns:[
    {id:'q1',speaker:'contact',text:'Send money.'},{id:'q2',speaker:'contact',text:'Send a code.'},
    {id:'r',speaker:'user',text:'I will send it.'},
  ]};
  const items=['q1','q2'].map((requestTurnId)=>({conversationId:'one',requestTurnId,responseTurnId:'r',category:'payment',classification:'risky',evidence:'I will send it.'}));
  assert.equal(validateOpportunities(items,[conversation]).length,1);
});
test('scoring rejects invented evidence and contact turns presented as user responses', () => {
  assert.throws(() => validateOpportunities([{...evidence[0],evidence:'made up'}], conversations));
  assert.throws(() => validateOpportunities([{...evidence[0],responseTurnId:'a',evidence:'Read me your code'}], conversations));
});
