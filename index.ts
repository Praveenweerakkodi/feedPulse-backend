import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { connectDB, isDBConnected } from "./config/database";
import feedbackRoutes from "./routes/feedback.routes";
import authRoutes from "./routes/auth.routes";

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security Middleware
app.use(helmet());

// CORS Setup
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://feedpulse-delta.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Database Connection Middleware for Vercel Serverless
app.use(async (_req, _res, next) => {
  try {
    if (!isDBConnected()) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error("Database connection failed:", error);
    next(error);
  }
});

// Body Parsing Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Root Route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "FeedPulse API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health Check Route
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "FeedPulse API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/feedback", feedbackRoutes);
app.use("/api/auth", authRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: "The endpoint you are looking for does not exist",
  });
});

// Global Error Handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  },
);

//  Start Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n FeedPulse API running on http://localhost:${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` Environment: ${process.env.NODE_ENV || "development"}\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Only start server if running locally, not as a Vercel serverless function
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  startServer().catch(console.error);
}

export default app;
