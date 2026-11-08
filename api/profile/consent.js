import { protectedRoute } from '../../server/http.js';
export default protectedRoute(['POST'],(service,uid,body)=>service.setConsent(uid,body),'profile');
