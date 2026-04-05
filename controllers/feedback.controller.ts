import { Request, Response } from 'express';
import { Feedback } from '../models/Feedback.model';
import { analyseFeedback, generateWeeklySummary } from '../services/gemini.service';


export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, category, submitterName, submitterEmail } = req.body;

    const submitterIp = req.ip || req.socket.remoteAddress || 'unknown';

    const feedback = await Feedback.create({
      title: title.trim(),
      description: description.trim(),
      category,
      submitterName: submitterName?.trim() || undefined,
      submitterEmail: submitterEmail?.trim().toLowerCase() || undefined,
      submitterIp,
      ai_processed: false, 
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully! Our AI is analysing it now.',
      data: {
        id: feedback._id,
        title: feedback.title,
        category: feedback.category,
        status: feedback.status,
        ai_processed: feedback.ai_processed,
        createdAt: feedback.createdAt,
      },
    });

  
    (async () => {
      try {
        console.log(`🤖 Starting AI analysis for feedback: ${feedback._id}`);
        const analysis = await analyseFeedback(title, description);

        // Save the AI results back to the feedback document
        await Feedback.findByIdAndUpdate(feedback._id, {
          ai_category: analysis.category,
          ai_sentiment: analysis.sentiment,
          ai_priority: analysis.priority_score,
          ai_summary: analysis.summary,
          ai_tags: analysis.tags,
          ai_processed: true, 
        });

        console.log(`✅ AI analysis saved for feedback: ${feedback._id}`);
      } catch (aiError) {
       
        console.error(`⚠️  AI analysis failed for feedback ${feedback._id}:`, aiError);
      
      }
    })();

  } catch (error) {

    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.message,
      });
      return;
    }

    console.error('submitFeedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to submit feedback. Please try again.',
    });
  }
};


export const getAllFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
   
    const {
      status,     
      category,     
      sentiment,  
      sort = 'createdAt',
      order = 'desc',    
      page = '1',        
      limit = '10',    
      search,            
    } = req.query;

    const filter: Record<string, any> = {};

    if (status && ['New', 'In Review', 'Resolved'].includes(status as string)) {
      filter.status = status;
    }
    if (category && ['Bug', 'Feature Request', 'Improvement', 'Other'].includes(category as string)) {
      filter.category = category;
    }
    if (sentiment && ['Positive', 'Neutral', 'Negative'].includes(sentiment as string)) {
      filter.ai_sentiment = sentiment;
    }

   
    if (search && typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

   
    const validSortFields = ['createdAt', 'ai_priority', 'ai_sentiment', 'updatedAt'];
    const sortField = validSortFields.includes(sort as string) ? (sort as string) : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj: Record<string, 1 | -1> = { [sortField]: sortOrder };

  
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10)); // Cap at 50
    const skipNum = (pageNum - 1) * limitNum;

    
    const [feedbackItems, totalCount] = await Promise.all([
      Feedback.find(filter)
        .sort(sortObj)
        .skip(skipNum)
        .limit(limitNum)
        .select('-submitterIp') 
        .lean(), 
      Feedback.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: feedbackItems,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });

  } catch (error) {
    console.error('getAllFeedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to retrieve feedback.',
    });
  }
};


export const getFeedbackStats = async (_req: Request, res: Response): Promise<void> => {
  try {

    const [total, openItems, resolvedItems, priorityData, tagData] = await Promise.all([
      
      Feedback.countDocuments(),

      Feedback.countDocuments({ status: { $in: ['New', 'In Review'] } }),

      Feedback.countDocuments({ status: 'Resolved' }),

      Feedback.aggregate([
        { $match: { ai_processed: true } },
        { $group: { _id: null, avgPriority: { $avg: '$ai_priority' } } },
      ]),

      Feedback.aggregate([
        { $match: { ai_processed: true, ai_tags: { $exists: true, $ne: [] } } },
        { $unwind: '$ai_tags' },
        { $group: { _id: '$ai_tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        openItems,
        resolvedItems,
        avgPriority: priorityData[0]?.avgPriority
          ? Math.round(priorityData[0].avgPriority * 10) / 10 
          : null,
        topTag: tagData[0]?._id || null,
      },
    });

  } catch (error) {
    console.error('getFeedbackStats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to get stats.',
    });
  }
};


export const getWeeklySummary = async (_req: Request, res: Response): Promise<void> => {
  try {

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentFeedback = await Feedback.find({
      createdAt: { $gte: sevenDaysAgo },
      ai_processed: true,
    })
      .sort({ ai_priority: -1 }) 
      .limit(20)
      .select('title ai_summary ai_tags ai_priority')
      .lean();

    const summary = await generateWeeklySummary(recentFeedback);

    res.status(200).json({
      success: true,
      data: {
        summary,
        feedbackCount: recentFeedback.length,
        generatedAt: new Date().toISOString(),
        period: '7 days',
      },
    });

  } catch (error) {
    console.error('getWeeklySummary error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to generate summary.',
    });
  }
};

export const getFeedbackById = async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await Feedback.findById(req.params.id).select('-submitterIp');

    if (!feedback) {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Feedback item not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: feedback,
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({
        success: false,
        error: 'Invalid ID',
        message: 'The provided ID is not valid.',
      });
      return;
    }

    console.error('getFeedbackById error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Failed to retrieve feedback.',
    });
  }
};


export const updateFeedbackStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const validStatuses = ['New', 'In Review', 'Resolved'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true } 
    ).select('-submitterIp');

    if (!feedback) {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Feedback item not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Status updated to "${status}"`,
      data: feedback,
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ success: false, error: 'Invalid ID', message: 'Invalid feedback ID.' });
      return;
    }
    console.error('updateFeedbackStatus error:', error);
    res.status(500).json({ success: false, error: 'Server error', message: 'Failed to update status.' });
  }
};


export const reanalyzeFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      res.status(404).json({ success: false, error: 'Not found', message: 'Feedback item not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'AI re-analysis started. Results will appear shortly.',
    });

    (async () => {
      try {
        const analysis = await analyseFeedback(feedback.title, feedback.description);
        await Feedback.findByIdAndUpdate(feedback._id, {
          ai_category: analysis.category,
          ai_sentiment: analysis.sentiment,
          ai_priority: analysis.priority_score,
          ai_summary: analysis.summary,
          ai_tags: analysis.tags,
          ai_processed: true,
        });
        console.log(`✅ Re-analysis complete for: ${feedback._id}`);
      } catch (err) {
        console.error(`❌ Re-analysis failed for: ${feedback._id}`, err);
      }
    })();

  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ success: false, error: 'Invalid ID', message: 'Invalid feedback ID.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Server error', message: 'Failed to trigger re-analysis.' });
  }
};

export const deleteFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);

    if (!feedback) {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Feedback item not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully.',
      data: { id: req.params.id },
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ success: false, error: 'Invalid ID', message: 'Invalid feedback ID.' });
      return;
    }
    console.error('deleteFeedback error:', error);
    res.status(500).json({ success: false, error: 'Server error', message: 'Failed to delete feedback.' });
  }
};
