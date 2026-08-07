import { sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { sessions, users } from "../db/schema";
import { HttpError } from "../http/validation";
import type { RequestHandler } from "express";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Session renewal threshold: renew if expiring within 7 days
const RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_DAYS = 30;

/**
 * Middleware to authenticate requests using session cookie.
 * Adds user to request if valid session exists.
 * Renews session if expiring soon.
 */
export const authenticate: RequestHandler = async (req, res, next) => {
  const sessionToken = req.cookies?.session;

  if (!sessionToken) {
    next();
    return;
  }

  try {
    const { db } = await getDatabase();

    // Find valid session
    const session = await db
      .select()
      .from(sessions)
      .where(sql`${sessions.token} = ${sessionToken}`)
      .limit(1)
      .then((rows) => rows[0]);

    if (!session || new Date() > new Date(session.expiresAt)) {
      next();
      return;
    }

    // Get user
    const user = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(sql`${users.id} = ${session.userId}`)
      .limit(1)
      .then((rows) => rows[0]);

    if (user) {
      req.user = user;

      // Renew session if expiring soon
      const sessionExpiry = new Date(session.expiresAt).getTime();
      const now = Date.now();

      if (sessionExpiry - now < RENEWAL_THRESHOLD_MS) {
        const newExpiry = new Date(now + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        await db
          .update(sessions)
          .set({ expiresAt: newExpiry })
          .where(sql`${sessions.id} = ${session.id}`);

        // Update cookie
        res.cookie("session", sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          expires: newExpiry,
          path: "/",
        });
      }
    }
  } catch (error) {
    // Don't fail the request if auth check fails
    console.error("[auth] Error checking session:", error);
  }

  next();
};

/**
 * Middleware to require authentication.
 * Must be used after authenticate middleware.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }
  next();
};

/**
 * Optional authentication middleware.
 * Adds user to request if available, but doesn't fail if not.
 * Use for public routes that optionally show user-specific content.
 */
export const optionalAuth: RequestHandler = authenticate;
