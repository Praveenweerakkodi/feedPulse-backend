import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        role: string;
      };
    }
  }
}

interface JwtPayload {
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export const authenticateAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No authentication token provided. Please log in.",
      });
      return;
    }

    const token = authHeader.substring(7);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    req.user = {
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: "Token expired",
        message: "Your session has expired. Please log in again.",
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Invalid authentication token. Please log in again.",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Auth error",
        message: "Authentication failed due to a server error.",
      });
    }
  }
};
