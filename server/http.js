import { backend, createFirestoreStore } from './firebase.js';
import { requireVerified, httpError } from './auth.js';
import { createService } from './service.js';
import { callNemotron, modelName } from './nemotron.js';

export function protectedRoute(methods, operation, kind='analysis') {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if (!methods.includes(req.method)) {
      res.setHeader('Allow',methods.join(', '));
      return res.status(405).json({error:'Method not supported.'});
    }
    try {
      if (Number(req.headers['content-length'] || 0) > 60000) throw httpError(413,'This request is too large.');
      if (!req.headers.authorization?.startsWith('Bearer ')) throw httpError(401,'Please sign in to continue.');
      const {auth,db}=backend();
      const user=await requireVerified(req.headers,(token,revoked)=>auth.verifyIdToken(token,revoked));
      const store=createFirestoreStore(db);
      if (!await store.takeRateLimit(user.uid,kind,kind === 'profile' ? 8 : 45)) throw httpError(429,'Please wait a minute before trying again.');
      const service=createService({store,model:callNemotron,modelName});
      const body=typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result=await operation(service,user.uid,body || {});
      return res.status(200).json(result);
    } catch (error) {
      const status=error.status || (error instanceof SyntaxError ? 400 : 500);
      if([429,503].includes(status))res.setHeader('Retry-After','30');
      // Deliberately do not log request bodies, tokens, or provider responses.
      return res.status(status).json({error:status === 500 ? 'We could not complete that request. Please try again.' : error.message});
    }
  };
}
