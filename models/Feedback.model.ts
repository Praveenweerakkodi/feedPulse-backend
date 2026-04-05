

import mongoose, { Document, Schema } from 'mongoose';


export interface IFeedback extends Document {

  title: string;
  description: string;
  category: 'Bug' | 'Feature Request' | 'Improvement' | 'Other';
  status: 'New' | 'In Review' | 'Resolved';
  submitterName?: string;   
  submitterEmail?: string;  
  submitterIp?: string;     

  // AI analysis fields 
  ai_category?: string;
  ai_sentiment?: 'Positive' | 'Neutral' | 'Negative';
  ai_priority?: number;     
  ai_summary?: string;
  ai_tags?: string[];
  ai_processed: boolean;   

  createdAt: Date;
  updatedAt: Date;
}

//  Mongoose Schema 
const FeedbackSchema = new Schema<IFeedback>(
  {

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },


    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
    },

    category: {
      type: String,
      enum: {
        values: ['Bug', 'Feature Request', 'Improvement', 'Other'],
        message: 'Category must be Bug, Feature Request, Improvement, or Other',
      },
      required: [true, 'Category is required'],
    },

    status: {
      type: String,
      enum: {
        values: ['New', 'In Review', 'Resolved'],
        message: 'Status must be New, In Review, or Resolved',
      },
      default: 'New',
    },

    submitterName: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    submitterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
    },

  
    submitterIp: {
      type: String,
      select: false,
    },

    // AI Fields
    ai_category: { type: String },
    ai_sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
    },
    ai_priority: {
      type: Number,
      min: 1,
      max: 10,
    },
    ai_summary: { type: String },
    ai_tags: { type: [String], default: [] },

    ai_processed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


FeedbackSchema.index({ status: 1 });

FeedbackSchema.index({ category: 1 });

FeedbackSchema.index({ ai_priority: -1 }); 

FeedbackSchema.index({ createdAt: -1 });

FeedbackSchema.index({ status: 1, createdAt: -1 });

FeedbackSchema.index({ title: 'text', ai_summary: 'text' });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema);
