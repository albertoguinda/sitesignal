import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "./test-app";

const app = createTestApp();

describe("Organizations Endpoints", () => {
  describe("GET /api/organizations", () => {
    it("returns unauthenticated for no session", async () => {
      const response = await request(app)
        .get("/api/organizations")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/organizations", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .send({ name: "Test Org", slug: "test-org" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/organizations/:id", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .get("/api/organizations/org-123")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PUT /api/organizations/:id", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .put("/api/organizations/org-123")
        .send({ name: "Updated Name" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/organizations/:id", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .delete("/api/organizations/org-123")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/organizations/:id/invite", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .post("/api/organizations/org-123/invite")
        .send({ email: "user@example.com", role: "member" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("DELETE /api/organizations/:id/members/:memberId", () => {
    it("returns error for unauthenticated request", async () => {
      const response = await request(app)
        .delete("/api/organizations/org-123/members/member-123")
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });
});
