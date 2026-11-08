import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {backend,createFirestoreStore} from './firebase.js';
import {httpError,requireVerified} from './auth.js';
import {callNemotron} from './nemotron.js';
import {elevenLabs} from './elevenlabs.js';
import {createCallService} from './call.js';
import {createService} from './service.js';

export function createCallHandler({env=process.env,audio,model=callNemotron}={}) {
  const localLimits=new Map();
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not supported.'});}
    try{
      if(Number(req.headers['content-length']||0)>60000)throw httpError(413,'This request is too large.');
      if(!req.headers['content-type']?.startsWith('application/json'))throw httpError(415,'Send a JSON request.');
      if(req.headers.origin){
        let origin;try{origin=new URL(req.headers.origin);}catch{throw httpError(403,'Open audio from this application.');}
        if(origin.host!==req.headers.host)throw httpError(403,'Open audio from this application.');
      }
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
      if(!['token','reply','speech','analyze'].includes(body?.action))throw httpError(400,'Choose an audio action.');
      const isLocal=!env.VERCEL&&env.NODE_ENV!=='production'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
      let accountUid,accountStore;
      const kind=body.action==='token'?'call-token':'call-'+body.action;
      const limit=body.action==='token'?6:body.action==='analyze'?40:20;
      if(req.headers.authorization||!isLocal){
        if(!req.headers.authorization&&env.LIVE_DEMO_ENABLED!=='true')throw httpError(401,'Sign in with a verified email to use live audio.');
        const {auth,db}=backend();
        let uid;
        if(req.headers.authorization){uid=(await requireVerified(req.headers,(token,revoked)=>auth.verifyIdToken(token,revoked))).uid;accountUid=uid;accountStore=createFirestoreStore(db);}
        else{
          // Vercel supplies this address; never trust a client-selected guest ID.
          const address=env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
          uid='guest-'+createHash('sha256').update(String(address||'unknown')).digest('hex');
        }
        if(!await createFirestoreStore(db).takeRateLimit(uid,kind,limit))throw httpError(429,'Please wait a minute before trying more audio.');
      }else{
        const now=Date.now();
        for(const [key,value] of localLimits)if(now-value.start>=60000)localLimits.delete(key);
        const entry=localLimits.get(kind)||{start:now,count:0};entry.count++;localLimits.set(kind,entry);
        if(entry.count>limit)throw httpError(429,'Please wait a minute before trying more audio.');
      }
      const provider=audio||elevenLabs(),service=createCallService({model});
      if(body.action==='token'){
        if(!audio&&!env.OPENROUTER_API_KEY)throw httpError(503,'Nemotron is not configured. Add OPENROUTER_API_KEY to the server environment.');
        return res.status(200).json(await provider.token());
      }
      if(body.action==='analyze')return res.status(200).json(accountUid?await createService({store:accountStore,model}).analyze(accountUid,{...body,channel:'call'}):await service.analyze(body));
      if(body.action==='reply')return res.status(200).json(await service.reply(body));
      const controller=new AbortController();
      const disconnected=()=>{if(!res.writableEnded)controller.abort();};
      res.on('close',disconnected);
      try{
        const upstream=await provider.speech(body.text,controller.signal);
        res.status(200);res.setHeader('Content-Type','audio/pcm');res.setHeader('X-Audio-Sample-Rate','16000');
        for await(const chunk of upstream.body){if(controller.signal.aborted)break;if(!res.write(chunk))await once(res,'drain',{signal:controller.signal});}
        res.end();
      }finally{res.off('close',disconnected);controller.abort();}
    }catch(error){
      if(res.headersSent){res.end();return;}
      const status=error.status||(error instanceof SyntaxError?400:500);
      if([429,503].includes(status))res.setHeader('Retry-After','30');
      res.status(status).json({error:status===500?'Audio could not start. Please try again.':error.message});
    }
  };
}
