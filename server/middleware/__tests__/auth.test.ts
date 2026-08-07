import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Hoisted references for vi.mock factory
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../db/client", () => ({
  getDatabase: vi.fn().mockResolvedValue({ db: mockDb }),
}));

const { authenticate, requireAuth } = await import("../auth");
const { HttpError } = await import("../../http/validation");

function createMockReq(cookies: Record<string, string> = {}): Partial<Request> {
  return { cookies, user: undefined };
}

function createMockRes(): Partial<Response> {
  return { cookie: vi.fn() } as unknown as Partial<Response>;
}

const next = vi.fn() as NextFunction;

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
  });

  describe("authenticate", () => {
    it("calls next() immediately if no session cookie", async () => {
      const req = createMockReq({});
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it("sets user on request if valid session found", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };
      mockDb.limit
        .mockResolvedValueOnce([{ id: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 86400000) }])
        .mockResolvedValueOnce([mockUser]);

      const req = createMockReq({ session: "valid-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it("does not set user if session expired", async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: "session-1", userId: "user-1", expiresAt: new Date(Date.now() - 1000) }]);

      const req = createMockReq({ session: "expired-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("does not set user if no session found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const req = createMockReq({ session: "nonexistent-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("does not set user if user not found in DB", async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ id: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 86400000) }])
        .mockResolvedValueOnce([]);

      const req = createMockReq({ session: "valid-token-no-user" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("renews session if expiring within 7 days", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };
      const expiringSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      mockDb.limit
        .mockResolvedValueOnce([{ id: "session-1", userId: "user-1", expiresAt: expiringSoon }])
        .mockResolvedValueOnce([mockUser]);

      const req = createMockReq({ session: "renew-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });

    it("does not renew session if not expiring soon", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };
      const notExpiringSoon = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      mockDb.limit
        .mockResolvedValueOnce([{ id: "session-1", userId: "user-1", expiresAt: notExpiringSoon }])
        .mockResolvedValueOnce([mockUser]);

      const req = createMockReq({ session: "fresh-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toEqual(mockUser);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("does not fail request if DB error occurs", async () => {
      mockDb.select.mockImplementation(() => { throw new Error("DB error"); });

      const req = createMockReq({ session: "error-token" });
      const res = createMockRes();

      await authenticate(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("requireAuth", () => {
    it("throws 401 if no user on request", () => {
      const req = createMockReq({});

      try {
        requireAuth(req as Request, {} as Response, next);
        expect.fail("should have thrown");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpError);
        expect(e.status).toBe(401);
      }
    });

    it("calls next() if user exists", () => {
      const req = createMockReq({});
      req.user = { id: "user-1", email: "test@example.com", name: "Test" };

      requireAuth(req as Request, {} as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
