import { protectedRoute } from '../../server/http.js';
export default protectedRoute(['POST'],(service,uid,body)=>service.assess(uid,body),'profile');
