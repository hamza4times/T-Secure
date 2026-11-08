import { protectedRoute } from '../server/http.js';
const get=protectedRoute(['GET'],(service,uid)=>service.profile(uid));
const remove=protectedRoute(['DELETE'],(service,uid)=>service.deleteAssessment(uid),'profile');
export default (req,res)=>(req.method === 'DELETE' ? remove : get)(req,res);
