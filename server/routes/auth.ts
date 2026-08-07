import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { magicLinks, sessions, users } from "../db/schema";
import { HttpError } from "../http/validation";

export const authRouter: Router = Router();

// Configuration
const MAGIC_LINK_EXPIRY_MINUTES = 15;
const SESSION_EXPIRY_DAYS = 30;
// Replit exposes the external domain; fallback to localhost for local dev
const BASE_URL = process.env.REPL_URL
  || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : "http://localhost:5000");

// Request schema
const requestMagicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Generate a secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Rate limiting for magic link requests
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(email);
    }
  }
}, CLEANUP_INTERVAL_MS);

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(email);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * POST /api/auth/magic-link
 * Request a magic link to be sent to the provided email.
 */
authRouter.post("/magic-link", async (req, res) => {
  const body = requestMagicLinkSchema.parse(req.body);
  const { email } = body;

  // Rate limit check
  if (!checkRateLimit(email)) {
    throw new HttpError(429, "Too many requests. Please try again later.");
  }

  const { db } = await getDatabase();

  // Find or create user
  let user = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${email}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({ email })
      .returning();
    user = newUser;
  }

  if (!user) {
    throw new HttpError(500, "Failed to create or find user");
  }

  // Generate magic link token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  // Clean up expired and used magic links
  const deletedCount = await db
    .delete(magicLinks)
    .where(sql`${magicLinks.expiresAt} < NOW() OR ${magicLinks.usedAt} IS NOT NULL`)
    .returning({ id: magicLinks.id });

  if (deletedCount.length > 0) {
    console.log(`[auth] Cleaned up ${deletedCount.length} expired/used magic links`);
  }

  // Store the magic link
  await db.insert(magicLinks).values({
    userId: user.id,
    token,
    email,
    expiresAt,
  });

  // In production, you would send an email here
  // For development, we'll log the link
  const magicLinkUrl = `${BASE_URL}/api/auth/verify?token=${token}`;

  console.log(`[auth] Magic link for ${email}: ${magicLinkUrl}`);

  // TODO: Send email with magicLinkUrl
  // await sendEmail({ to: email, subject: "Sign in to SiteSignal", html: `...` })

  res.json({
    message: "Magic link sent to your email",
    // Always include the link for demo purposes (no email service configured)
    link: magicLinkUrl,
  });
});

/**
 * GET /api/auth/verify?token=xxx
 * Verify a magic link token and create a session.
 */
authRouter.get("/verify", async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    throw new HttpError(400, "Invalid or missing token");
  }

  const { db } = await getDatabase();

  // Find the magic link
  const magicLink = await db
    .select()
    .from(magicLinks)
    .where(sql`${magicLinks.token} = ${token}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!magicLink) {
    throw new HttpError(400, "Invalid token");
  }

  // Check if token is expired
  if (new Date() > new Date(magicLink.expiresAt)) {
    throw new HttpError(400, "Token has expired. Please request a new magic link.");
  }

  // Check if token was already used
  if (magicLink.usedAt) {
    throw new HttpError(400, "Token has already been used");
  }

  // Mark token as used
  await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(sql`${magicLinks.id} = ${magicLink.id}`);

  // Create a session
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId: magicLink.userId,
    token: sessionToken,
    expiresAt,
  });

  // Set session cookie
  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  // Redirect to dashboard
  res.redirect("/");
});

/**
 * GET /api/auth/me
 * Get current user from session.
 */
authRouter.get("/me", async (req, res) => {
  const sessionToken = req.cookies?.session;

  if (!sessionToken) {
    res.json({ user: null });
    return;
  }

  const { db } = await getDatabase();

  // Find valid session
  const session = await db
    .select()
    .from(sessions)
    .where(sql`${sessions.token} = ${sessionToken}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!session || new Date() > new Date(session.expiresAt)) {
    res.json({ user: null });
    return;
  }

  // Get user
  const user = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`${users.id} = ${session.userId}`)
    .limit(1)
    .then((rows) => rows[0]);

  res.json({ user: user || null });
});

/**
 * POST /api/auth/logout
 * Destroy session and clear cookie.
 */
authRouter.post("/logout", async (req, res) => {
  const sessionToken = req.cookies?.session;

  if (sessionToken) {
    const { db } = await getDatabase();
    await db.delete(sessions).where(sql`${sessions.token} = ${sessionToken}`);
  }

  res.clearCookie("session");
  res.json({ message: "Logged out successfully" });
});
