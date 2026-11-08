import { protectedRoute } from '../server/http.js';
import { requireDeveloper } from '../server/developer.js';
import { providerStatus } from '../server/ai-provider.js';
import { EVALUATION_SCENARIOS } from '../shared/evaluation.js';

const scenarios=EVALUATION_SCENARIOS.map(({id,type,title,expected})=>({id,type,title,expected}));
// GET: provider configuration and previously measured results. POST {provider}: run the scenarios.
const status=protectedRoute(['GET'],async(service,uid,body,{user,store})=>{
  requireDeveloper(user);
  return {providers:providerStatus(),scenarios,stored:await store.getEvaluations()};
},'benchmark');
const run=protectedRoute(['POST'],(service,uid,body,{user})=>{
  requireDeveloper(user);
  return service.benchmark(body);
},'benchmark');
export default (req,res)=>(req.method==='POST'?run:status)(req,res);
