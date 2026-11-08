import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Firebase functions boot and signing keys work without CommonJS require(ESM)',()=>{
  const script=`
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {generateKeyPairSync,sign,verify} from 'node:crypto';
    for(const [path,method] of [['./api/analyze.js','POST'],['./api/analyze-sms.js','POST'],['./api/analyze-call.js','POST'],['./api/benchmark-models.js','GET'],['./api/benchmark-models.js','POST']]){
      const {default:handler}=await import(path);
      const res={setHeader(){},status(status){this.statusCode=status;return this;},json(body){this.body=body;return this;}};
      await handler({method,headers:{}},res);
      assert.equal(res.statusCode,401,path+' must reject missing identity after a successful startup.');
      assert.match(res.body.error,/sign in/i);
    }
    const require=createRequire(import.meta.url);
    const jwks=require('jwks-rsa');
    const secretProvider=jwks.passportJwtSecret({jwksUri:'https://unused.example.test'});
    await new Promise((resolve,reject)=>secretProvider(null,'malformed-token',(error,key)=>{
      try{assert.equal(error,null);assert.equal(key,null);resolve();}catch(error){reject(error);}
    }));
    const {retrieveSigningKeys}=require('jwks-rsa/src/utils.js');
    const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
    const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-runtime-key',use:'sig',alg:'RS256'};
    const keys=await retrieveSigningKeys([jwk]);
    assert.equal(keys.length,1);
    assert.equal(keys[0].kid,jwk.kid);
    const message=Buffer.from('Synthetic runtime compatibility test');
    const signature=sign('RSA-SHA256',message,privateKey);
    assert.equal(verify('RSA-SHA256',message,keys[0].getPublicKey(),signature),true);
    assert.equal(verify('RSA-SHA256',Buffer.from('tampered'),keys[0].getPublicKey(),signature),false);
    console.log('Function startup and RSA signing-key validation passed.');
  `;
  const result=spawnSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',script],{cwd:process.cwd(),encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
});
