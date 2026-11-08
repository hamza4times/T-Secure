import { protectedRoute } from '../server/http.js';
// Progressive call transcripts ("contact: …" / "user: …" lines). Same pipeline as /api/analyze.
export default protectedRoute(['POST'],(service,uid,body)=>service.analyze(uid,{...body,channel:'call'}));
