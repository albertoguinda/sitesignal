import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { apiRouter } from "../routes";
import { authenticate } from "../middleware/auth";
import { HttpError } from "../http/validation";
import type { ApiError } from "../../shared/types";

// Hoisted references that can be used inside vi.mock factories
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../db/client", () => ({
  getDatabase: vi.fn().mockResolvedValue({ db: mockDb }),
}));

// Create test app
function createTestApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.use(authenticate);
  app.use("/api", apiRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      const body: ApiError = { error: error.message, ...(error.detail && { detail: error.detail }) };
      res.status(error.status).json(body);
      return;
    }
    if (error instanceof ZodError) {
      const messages = error.issues.map((i) => i.message).join(", ");
      const body: ApiError = { error: messages };
      res.status(400).json(body);
      return;
    }
    console.error("[test] unhandled error:", error);
    const body: ApiError = { error: "Internal server error" };
    res.status(500).json(body);
  });

  return app;
}

const app = createTestApp();

describe("Auth Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([]);
    mockDb.delete.mockReturnThis();
  });

  describe("POST /api/auth/magic-link", () => {
    it("returns success for valid email", async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: "user-1", email: "test@example.com" }]);
      
      const response = await request(app)
        .post("/api/auth/magic-link")
        .send({ email: "test@example.com" })
        .expect(200);

      expect(response.body).toHaveProperty("message");
    });

    it("returns error for invalid email format", async () => {
      const response = await request(app)
        .post("/api/auth/magic-link")
        .send({ email: "not-an-email" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("returns error for missing email", async () => {
      const response = await request(app)
        .post("/api/auth/magic-link")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/verify", () => {
    it("returns error for invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/verify?token=invalid-token")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("returns error for missing token", async () => {
      const response = await request(app)
        .get("/api/auth/verify")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns unauthenticated for no session", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toBeNull();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears session", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .expect(200);

      expect(response.body).toHaveProperty("message");
    });
  });
});
