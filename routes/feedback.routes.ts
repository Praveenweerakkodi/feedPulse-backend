

import { Router } from 'express';
import {
  submitFeedback,
  getAllFeedback,
  getFeedbackById,
  getFeedbackStats,
  getWeeklySummary,
  updateFeedbackStatus,
  reanalyzeFeedback,
  deleteFeedback,
} from '../controllers/feedback.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';
import { feedbackSubmitLimiter } from '../middleware/rateLimit.middleware';

const router = Router();


router.post('/', feedbackSubmitLimiter, submitFeedback);


router.get('/stats', authenticateAdmin, getFeedbackStats);


router.get('/summary', authenticateAdmin, getWeeklySummary);

router.get('/', authenticateAdmin, getAllFeedback);

router.get('/:id', authenticateAdmin, getFeedbackById);

router.patch('/:id', authenticateAdmin, updateFeedbackStatus);

router.patch('/:id/reanalyze', authenticateAdmin, reanalyzeFeedback);

router.delete('/:id', authenticateAdmin, deleteFeedback);

export default router;
