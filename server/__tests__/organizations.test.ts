import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { apiRouter } from "../routes";
import { authenticate } from "../middleware/auth";
import { HttpError } from "../http/validation";
import type { ApiError } from "../../shared/types";

// Hoisted mock db
const { mockDb } = vi.hoisted(() => {
  const db: Record<string, any> = {};
  for (const m of ["select", "from", "where", "innerJoin", "insert", "values", "update", "set", "delete"]) {
    db[m] = vi.fn().mockReturnValue(db);
  }
  for (const m of ["limit", "returning", "orderBy"]) {
    db[m] = vi.fn().mockResolvedValue([]);
  }
  return { mockDb: db };
});

vi.mock("../db/client", () => ({
  getDatabase: vi.fn().mockResolvedValue({ db: mockDb }),
}));

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

describe("Organizations Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const m of ["select", "from", "where", "innerJoin", "insert", "values", "update", "set", "delete"]) {
      (mockDb as any)[m].mockReturnValue(mockDb);
    }
    for (const m of ["limit", "returning", "orderBy"]) {
      (mockDb as any)[m].mockResolvedValue([]);
    }
  });

  describe("POST /api/organizations", () => {
    it("returns 400 for missing name", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send({ slug: "test" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("returns 400 for invalid slug format", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send({ name: "Test", slug: "INVALID SLUG!" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("returns 400 for empty body", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/organizations/:id/invite", () => {
    it("returns 400 for invalid email", async () => {
      const response = await request(app)
        .post("/api/organizations/org-1/invite")
        .send({ email: "not-an-email", role: "member" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("returns 400 for invalid role", async () => {
      const response = await request(app)
        .post("/api/organizations/org-1/invite")
        .send({ email: "test@example.com", role: "superadmin" })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/organizations", () => {
    it("returns an array of organizations", async () => {
      // getDemoUserId needs limit(1) to return a user
      mockDb.limit.mockResolvedValueOnce([{ id: "demo-user-1" }]);
      // Main query uses orderBy as terminal
      mockDb.orderBy.mockResolvedValueOnce([
        { id: "org-1", name: "Acme Plant", slug: "acme" },
      ]);

      const response = await request(app)
        .get("/api/organizations")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
