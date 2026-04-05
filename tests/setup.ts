/**
 * Test Setup and Utilities
 * 
 * This file handles:
 * - MongoDB Memory Server setup for tests
 * - Express app initialization
 * - Database seeding
 * - Common test utilities
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express, { Express } from 'express';
import cors from 'cors';
import { User } from '../models/User.model';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import feedbackRoutes from '../routes/feedback.routes';
import authRoutes from '../routes/auth.routes';

let mongoServer: MongoMemoryServer;

/**
 * Initialize MongoDB Memory Server and connect
 */
export const connectTestDB = async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
};

/**
 * Disconnect from test database and close server
 */
export const disconnectTestDB = async (): Promise<void> => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

/**
 * Clear all collections
 */
export const clearDatabase = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

/**
 * Setup Express app for testing
 */
export const setupTestApp = (): Express => {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
  
  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'Server is healthy' });
  });
  
  // Routes
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/auth', authRoutes);
  
  return app;
};

/**
 * Create a test admin user and return JWT token
 */
export const createTestAdmin = async (): Promise<{ user: any; token: string }> => {
  const hashedPassword = await bcryptjs.hash('testpassword', 10);
  
  const user = await User.create({
    email: 'testadmin@example.com',
    password: 'testpassword',
    role: 'admin',
  });
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '7d',
  });
  
  return { user, token };
};

/**
 * Create valid feedback data
 */
export const createValidFeedbackData = () => ({
  title: 'Add dark mode to dashboard',
  description: 'I would like to see a dark mode theme for the dashboard to reduce eye strain.',
  category: 'Feature Request',
  submitterName: 'John Doe',
  submitterEmail: 'john@example.com',
});

/**
 * Create feedback with invalid data
 */
export const createInvalidFeedbackData = (field: string) => {
  const data = createValidFeedbackData();
  
  if (field === 'title') {
    return { ...data, title: '' };
  }
  if (field === 'description') {
    return { ...data, description: 'short' };
  }
  if (field === 'category') {
    return { ...data, category: 'InvalidCategory' };
  }
  
  return data;
};

export default {
  connectTestDB,
  disconnectTestDB,
  clearDatabase,
  setupTestApp,
  createTestAdmin,
  createValidFeedbackData,
  createInvalidFeedbackData,
};
