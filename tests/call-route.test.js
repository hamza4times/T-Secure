import test from 'node:test';
import assert from 'node:assert/strict';
import {createCallHandler} from '../server/call-http.js';

function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
const local={method:'POST',headers:{host:'localhost:5173',origin:'http://localhost:5173','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body:{action:'token'}};
test('local demo can mint only scoped transcription tokens and rejects cross-origin requests',async()=>{
  const handler=createCallHandler({env:{},audio:{token:async()=>({token:'one-use'})},model:async()=>({})});
  const res=response();await handler({...local},res);
  assert.equal(res.statusCode,200);assert.deepEqual(res.body,{token:'one-use'});
  const foreign=response();await handler({...local,headers:{...local.headers,origin:'https://foreign.example'}},foreign);
  assert.equal(foreign.statusCode,403);
});
test('production requires verified identity unless live guest demo is explicitly enabled',async()=>{
  const handler=createCallHandler({env:{VERCEL:'1'},audio:{token:async()=>({token:'one-use'})}});
  const res=response();await handler({...local},res);assert.equal(res.statusCode,401);
});
test('local demo token requests are rate limited before consuming provider credits',async()=>{
  const handler=createCallHandler({env:{},audio:{token:async()=>({token:'one-use'})}});
  for(let i=0;i<6;i++){const res=response();await handler({...local},res);assert.equal(res.statusCode,200);}
  const res=response();await handler({...local},res);assert.equal(res.statusCode,429);assert.equal(res.headers['Retry-After'],'30');
});
