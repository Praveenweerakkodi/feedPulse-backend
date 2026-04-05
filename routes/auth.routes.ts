
import { Router } from 'express';
import { login, setupAdmin, verifyToken } from '../controllers/auth.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';
import { loginLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/login', loginLimiter, login);

router.post('/setup', setupAdmin);

router.get('/verify', authenticateAdmin, verifyToken);

export default router;
