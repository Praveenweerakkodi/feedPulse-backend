import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Missing credentials",
        message: "Email and password are required.",
      });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    let isValidAdmin = false;
    let adminEmail = emailLower;

    try {
      const user = await User.findOne({ email: emailLower }).select(
        "+password",
      );
      if (user) {
        isValidAdmin = await user.comparePassword(password);
      }
    } catch (dbError) {
      console.warn(
        "DB user check failed, falling back to .env credentials:",
        dbError,
      );
    }

    if (!isValidAdmin) {
      const envEmail = process.env.ADMIN_EMAIL?.toLowerCase();
      const envPassword = process.env.ADMIN_PASSWORD;

      if (emailLower === envEmail && password === envPassword) {
        isValidAdmin = true;
        adminEmail = emailLower;
      }
    }

    if (!isValidAdmin) {
      res.status(401).json({
        success: false,
        error: "Invalid credentials",
        message: "Email or password is incorrect.",
      });
      return;
    }

    //  Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign({ email: adminEmail, role: "admin" }, jwtSecret, {
      expiresIn: "24h",
    });

    // Return the token
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        email: adminEmail,
        role: "admin",
        expiresIn: "24h",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Login failed due to a server error.",
    });
  }
};

export const setupAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Only allow setup if no admin users exist yet
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      res.status(409).json({
        success: false,
        error: "Already exists",
        message: "An admin user already exists.",
      });
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@feedpulse.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

    await User.create({
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    });

    res.status(201).json({
      success: true,
      message: `Admin user created with email: ${adminEmail}`,
    });
  } catch (error) {
    console.error("setupAdmin error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
      message: "Failed to create admin user.",
    });
  }
};

export const verifyToken = (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    data: {
      email: req.user?.email,
      role: req.user?.role,
    },
  });
};
