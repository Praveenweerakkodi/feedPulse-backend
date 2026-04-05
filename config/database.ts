import mongoose from "mongoose";

let isConnecting = false;

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  // Return if already connected (readyState === 1)
  if ((mongoose.connection.readyState as number) === 1) {
    console.log("✅ MongoDB already connected");
    return;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log("⏳ MongoDB connection in progress...");
    // Wait for connection to complete
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if ((mongoose.connection.readyState as number) === 1) {
      return;
    }
  }

  isConnecting = true;

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    console.log(`✅ MongoDB connected: ${connection.connection.host}`);
    isConnecting = false;

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
  } catch (error) {
    isConnecting = false;
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  // readyState 0 = disconnected, 3 = disconnecting
  if ((mongoose.connection.readyState as number) !== 0) {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
};

export const isDBConnected = (): boolean => {
  return (mongoose.connection.readyState as number) === 1;
};
