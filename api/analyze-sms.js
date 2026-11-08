import { protectedRoute } from '../server/http.js';
// Message and website-address checks. Same pipeline as /api/analyze, with the channel fixed.
export default protectedRoute(['POST'],(service,uid,body)=>service.analyze(uid,{...body,channel:body.channel==='link'?'link':'message'}));
